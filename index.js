import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import sql from "mssql";
import { OpenAI } from "openai";
import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, // Use environment variables for sensitive data
});

const config = {
    user: process.env.USER,
    password: process.env.PASSWORD,
    server: process.env.SERVER,
    database: process.env.DATABASE,
    options: {
        encrypt: true, // Use this if you're on Windows Azure
        enableArithAbort: true,
        trustServerCertificate: true // Add this line to trust self-signed certificates
    }
};

const poolPromise = new sql.ConnectionPool(config)
    .connect()
    .then(pool => {
        console.log('Connected to SQL Server');
        return pool;
    })
    .catch(err => {
        console.log('Database Connection Failed! Bad Config: ', err);
        throw err; // re-throw to stop the server start process
    });

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(cors());

app.get("/", (req, res) => {
    res.send("Hello, this is the root of the ChatGPT server.");
});

app.post("/", async (req, res) => {
    const { message } = req.body;

    try {
        const completion = await openai.chat.completions.create({
            messages: [{ role: "system", content: `${message}` }],
            model: "gpt-3.5-turbo",
        });

        res.json({
            completion: completion.choices[0]
        });
    } catch (error) {
        console.error("Error processing request:", error);
        res.status(500).json({ error: "Failed to process request" });
    }
});

app.post("/compare", async (req, res) => {
    const { message, model } = req.body;

    try {
        const completion = await openai.chat.completions.create({
            messages: [{ 
                role: "system", 
                content: `I have this question: ${message.QuestionTitle}, ${message.QuestionText}. 
                        And I have these three answers from Stack Overflow:
                        1. code number 1 - ${message.MaxScoreAnswerContent},
                        2. code number 2 - ${message.ClosestAnswerContent},
                        3. code number 3 - ${message.MinScoreAnswerContent}.      
                        
                        Tell me which of these three answers best answers the question I provided and explain why. Also, rate each answer on a scale of 1-10 with a brief explanation for each rating. Ensure that the answer does address the question and not just based on the level of extraction.
                        
                        Respond ONLY in JSON format as follows (do not nest any fields):
                        
                        {
                            "questionId": "${message.QuestionId}",
                            "question": "${message.QuestionTitle}, ${message.QuestionText}",
                            "tag": "${message.Tag}",
                            "model": "${model}",
                            "answer1": "${message.MaxScoreAnswerContent}",
                            "answer2": "${message.ClosestAnswerContent}",
                            "answer3": "${message.MinScoreAnswerContent}",                                                                                         
                            "better_question": "{answer}",
                            "why_better": "{explanation}",
                            "rating_Answer1": "{rating}",
                            "explanation_for_rating1": "{explanation}",
                            "rating_Answer2": "{rating}",
                            "explanation_for_rating2": "{explanation}",
                            "rating_Answer3": "{rating}",
                            "explanation_for_rating3": "{explanation}"                                                               
                        }`
            }],
            model: model, // Use the specified model here
        });

        const rawContent = completion.choices[0].message.content;
        if (!isValidJson(rawContent)) {
            throw new SyntaxError("Incomplete JSON response");
        }

        const response = JSON.parse(rawContent);

        // Add the result field based on the ratings
        const { rating_Answer1, rating_Answer2, rating_Answer3 } = response;

        if (rating_Answer1 >= rating_Answer2 && rating_Answer2 >= rating_Answer3) {
            response.result = "good";
        } else if (
            (rating_Answer1 >= rating_Answer3 && rating_Answer3 >= rating_Answer2) ||
            (rating_Answer2 >= rating_Answer1 && rating_Answer1 >= rating_Answer3) ||
            (rating_Answer3 >= rating_Answer2 && rating_Answer2 >= rating_Answer1)
        ) {
            response.result = "mid";
        } else if (
            (rating_Answer3 >= rating_Answer1 && rating_Answer1 >= rating_Answer2) ||
            (rating_Answer2 >= rating_Answer3 && rating_Answer3 >= rating_Answer1)
        ) {
            response.result = "bad";
        }

        if (isValidResponseStructure(response)) {
            await insertPrompt(response);
            res.json({ completion: response });
        } else {
            throw new Error("Invalid response structure");
        }
    } catch (error) {
        console.error("Failed to process request:", error);
        if (!res.headersSent) {
            res.status(500).json({ error: "Failed to process request" });
        }
    }
});

app.get("/api/results", async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query("SELECT * FROM gpt_responses");
        res.json(result.recordset);
    } catch (error) {
        console.error("Error fetching data:", error);
        res.status(500).json({ error: "Failed to fetch data", details: error.message });
    }
});

const isValidJson = (str) => {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
};

const isValidResponseStructure = (response) => {
    const requiredKeys = [
        "questionId", "tag", "model", "question", "answer1", "answer2", "answer3",
        "better_question", "why_better", "rating_Answer1", "explanation_for_rating1",
        "rating_Answer2", "explanation_for_rating2", "rating_Answer3", "explanation_for_rating3"
    ];
    return requiredKeys.every(key => key in response);
};

async function insertPrompt(data) {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('questionId', sql.NVarChar, data.questionId)
            .input('tag', sql.NVarChar, data.tag)
            .input('model', sql.NVarChar, data.model)
            .input('fullMessage', sql.NVarChar, data.question)
            .input('answer1', sql.NVarChar, data.answer1)
            .input('ratingAnswer1', sql.Int, data.rating_Answer1)
            .input('explanationForRating1', sql.NVarChar, data.explanation_for_rating1)
            .input('answer2', sql.NVarChar, data.answer2)
            .input('ratingAnswer2', sql.Int, data.rating_Answer2)
            .input('explanationForRating2', sql.NVarChar, data.explanation_for_rating2)
            .input('answer3', sql.NVarChar, data.answer3)
            .input('ratingAnswer3', sql.Int, data.rating_Answer3)
            .input('explanationForRating3', sql.NVarChar, data.explanation_for_rating3)
            .input('result', sql.NVarChar, data.result) // Add this line to insert the result field
            .query(`
                INSERT INTO gpt_responses (
                    questionId, tag, model, fullMessage, answer1, ratingAnswer1, explanationForRating1,
                    answer2, ratingAnswer2, explanationForRating2, answer3, ratingAnswer3, explanationForRating3, result
                ) VALUES (@questionId, @tag, @model, @fullMessage, @answer1, @ratingAnswer1, @explanationForRating1,
                          @answer2, @ratingAnswer2, @explanationForRating2, @answer3, @ratingAnswer3, @explanationForRating3, @result)
            `);
        console.log(result);
        return result;
    } catch (error) {
        console.error("Error inserting data:", error);
    }
}

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
});
