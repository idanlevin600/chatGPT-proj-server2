const chatLog = document.getElementById('chat-log');
        const message = document.getElementById('message');
        const form = document.querySelector('form');
        form.addEventListener('submit', (e)=>{
            e.preventDefault();
            const messageText = message.value;
            message.value = '';
            const messageElement = document.createElement('div');
            messageElement.classList.add('message');
            messageElement.classList.add('message--sent');
            messageElement.innerHTML = `<div class = "message__text">${messageText}</div>`;
            chatLog.appendChild(messageElement);
            chatLog.scrollTop = chatLog.scrollHeight;
            fetch('http://localhost:3000', {
                method:'POST', 
                headers:{
                    'Content-Type' : 'application/json'
                },
                body:JSON.stringify({
                    message: messageText
                })
            }) 
            .then(res => res.json())
            .then(data =>{
                const messageElement = document.createElement('div');
                messageElement.classList.add('message');
                messageElement.classList.add('message--recieved');
                messageElement.innerHTML = `<div class = "message__text">${data.completion.message.content}</div>`;
                createExample(data.completion.message.content); 
                console.log(data.completion.message.content);
                chatLog.appendChild(messageElement);
                chatLog.scrollTop = chatLog.scrollHeight;
            })
        })

        function createExample(data){
            var regex = /```\n([\s\S]*?)```/;
            var matches = data.match(regex);
            // Extracted code
            var code = matches ? matches[1] : '';
            let exampleDiv = document.getElementById("example")
            exampleDiv.innerHTML = code;
            console.log(code);
        }
        
        //the compare forms script
        const compareCodesLog = document.getElementById("compare-codes-log");
        const question = document.getElementById("question");
        const ans1 = document.getElementById("ans1");
        const ans2 = document.getElementById("ans2");
        const ans3 = document.getElementById("ans3");
        const ans4 = document.getElementById("ans4");
        const ans5 = document.getElementById("ans5");
        // const ans1rating = document.getElementById("ans1rating");
        // const ans2rating = document.getElementById("ans2rating");
        // const ans3rating = document.getElementById("ans3rating");
        // const ans4rating = document.getElementById("ans4rating");
        // const ans5rating = document.getElementById("ans5rating");
        const compareForm = document.getElementById("compareForm");
        compareForm.addEventListener('submit',(e) =>{
            e.preventDefault();
            const questionText = question.value;
            const ans1Text = ans1.value;
            const ans2Text = ans2.value;
            const ans3Text = ans3.value;
            const ans4Text = ans4.value;
            const ans5Text = ans5.value;
            // const fullMessageText = `I have this question: ${questionText}. 
            //                          and i heve this 2 answers:
            //                          code number 1 - ${ans1Text} and this is code number 2 - ${ans2Text}. 
            //                          Tell me which of these answers is better to answer the question
            //                          and tell me what is the difference between these 2 codes, also rate every answer on a scale of 1-10`; 
            //**** */
            const fullMessageText = {
                question: questionText,
                answer1: ans1Text,
                answer2: ans2Text,
                answer3: ans3Text,
                answer4: ans4Text,
                answer5: ans5Text,
                // answer1rating : ans1rating.value,
                // answer2rating : ans2rating.value,
                // answer3rating : ans3rating.value,
                // answer4rating : ans4rating.value,
                // answer5rating : ans5rating.value
            }                         
            //**** */           
            fetch('http://localhost:3000/compare', {
                
                method:'POST', 
                headers:{
                    'Content-Type' : 'application/json'
                },
                body:JSON.stringify({
                    message: fullMessageText
                })
            }) 
            .then(res => res.json())           
            .then(data => {
                // Parse the JSON string back into an object to format it
                const jsonData = JSON.parse(data.completion.message.content);
                
                // Convert the JSON object into a formatted string
                const formattedJson = JSON.stringify(jsonData, null, 2);
                
                // Create a new 'pre' element to display the formatted JSON
                const messageElement = document.createElement('pre');
                messageElement.classList.add('message');
                messageElement.classList.add('message--received');
                
                // Set the text of the 'pre' element to the formatted JSON string
                messageElement.textContent = formattedJson;
                console.log(formattedJson)
                
                // Append the new element to your log container
                compareCodesLog.appendChild(messageElement);
                
                // Scroll to the bottom of the log container
                compareCodesLog.scrollTop = compareCodesLog.scrollHeight;
            })        
        })

// const compareFiveAnswers = (e) =>{
//     e.preventDefault();
//     console.log(e.target);
// }        