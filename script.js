let currentQuestionIndex = 0;
let questions = [];
let selectedQuestions = [];
let totalMarks = 0;
let studentName = '';
const maxTotalMarks = 20;
const answers = [];
const currentDate = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
let studentList = [];
const examDuration = 10 * 60 * 1000; // 5 minutes in milliseconds
let timerInterval;
let timeRemaining = examDuration;

// DOM Elements
const startBtn = document.getElementById('start');
const studentFileInput = document.getElementById('student-file-input');
const studentSelection = document.getElementById('student-selection');
const proceedBtn = document.getElementById('proceed-to-upload');
const fileInput = document.getElementById('file-input');
const startQuizBtn = document.getElementById('start-quiz');
const nextBtn = document.getElementById('next');
const retestBtn = document.getElementById('retest');
const downloadReportBtn = document.getElementById('download-report');
const completedStudentsList = document.getElementById('completed-students-list');
const questionElem = document.getElementById('question');
const maxMarksElem = document.getElementById('max-marks');
const answerElem = document.getElementById('answer');
const timerElem = document.getElementById('timer'); // Timer display element

// Event Listeners
startBtn.addEventListener('click', showStudentSelection);
studentFileInput.addEventListener('change', readStudentList);
proceedBtn.addEventListener('click', proceedToUpload);
startQuizBtn.addEventListener('click', startQuiz);
nextBtn.addEventListener('click', nextQuestion);
retestBtn.addEventListener('click', retest);
downloadReportBtn.addEventListener('click', generateResultsXLSX);

function showSection(id) {
    document.querySelectorAll('.window').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(id).classList.add('active');
}

function showStudentSelection() {
    displayCompletedStudents();
    showSection('student-selection-container');
}

function readStudentList(event) {
    const file = event.target.files[0];
    if (!file) {
        alert('Please select an XLSX file.');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        try {
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            studentList = XLSX.utils.sheet_to_json(worksheet, { header: 1 }).flat();
            populateStudentDropdown();
        } catch (error) {
            console.error('Error reading student list:', error);
        }
    };
    reader.readAsArrayBuffer(file);
}

function populateStudentDropdown() {
    studentSelection.innerHTML = '<option value="" disabled selected>Select a student</option>';
    const attendedStudents = getAttendedStudents();
    studentList.forEach(studentName => {
        if (!attendedStudents.includes(studentName)) {
            const option = document.createElement('option');
            option.value = studentName;
            option.textContent = studentName;
            studentSelection.appendChild(option);
        }
    });
}

function displayCompletedStudents() {
    const completedStudents = getAttendedStudents();
    completedStudentsList.innerHTML = '';

    if (completedStudents.length === 0) {
        completedStudentsList.innerHTML = '<li>No students have completed the exam today.</li>';
    } else {
        completedStudents.forEach(student => {
            const li = document.createElement('li');
            li.textContent = student;
            completedStudentsList.appendChild(li);
        });
    }
}

function proceedToUpload() {
    studentName = document.getElementById('student-selection').value;
    if (!studentName) {
        alert('Please select a student.');
        return;
    }
    recordStudentAttendance(studentName);
    showSection('upload-container');
}

function startQuiz() {
    const file = fileInput.files[0];
    if (!file) {
        alert('Please select an XLSX file.');
        return;
    }

    readXLSXFile(file);
    showSection('quiz');
    startTimer();
}

function nextQuestion() {
    const answer = answerElem.value.trim();
    if (!answer) {
        alert('Please enter an answer.');
        return;
    }

    const currentQuestion = selectedQuestions[currentQuestionIndex];
    const marks = gradeAnswer(answer, currentQuestion.Keywords, currentQuestion.MaxMarks);
    answers.push({
        question: currentQuestion.Question,
        answer: answer,
        marks: marks,
        maxMarks: currentQuestion.MaxMarks
    });

    currentQuestionIndex++;
    
    if (currentQuestionIndex < selectedQuestions.length) {
        displayQuestion();
    } else {
        stopTimer();
        displayResults();
    }

    answerElem.value = '';
}

function gradeAnswer(answer, keywords, maxMarks) {
    let marks = 0;
    const keywordsArray = keywords.split(',').map(keyword => keyword.trim().toLowerCase());
    const lowerCaseAnswer = answer.toLowerCase();

    // Check each keyword to see if it is present in the answer
    keywordsArray.forEach(keyword => {
        if (lowerCaseAnswer.includes(keyword)) {
            marks++;
        }
    });

    // Ensure marks do not exceed the maximum marks for the question
    return Math.min(marks, maxMarks);
}

function displayQuestion() {
    if (currentQuestionIndex < selectedQuestions.length) {
	answerElem.focus();
        const currentQuestion = selectedQuestions[currentQuestionIndex];
        questionElem.innerText = currentQuestion.Question;
        maxMarksElem.innerText = `Max Marks: ${currentQuestion.MaxMarks}`;
    } else {
        stopTimer();
        displayResults();
    }
}

function displayResults() {
    showSection('results-container');

    const resultsTable = document.getElementById('results-table').querySelector('tbody');
    resultsTable.innerHTML = '';
    totalMarks = 0;

    answers.forEach(answer => {
        totalMarks += answer.marks;
        const row = resultsTable.insertRow();
        row.insertCell(0).innerText = answer.question;
        row.insertCell(1).innerText = answer.answer;
        row.insertCell(2).innerText = answer.marks;
        row.insertCell(3).innerText = answer.maxMarks;
    });

    document.getElementById('student-name-display').innerText = `Student Name: ${studentName}`;
    document.getElementById('date-display').innerText = `Date: ${currentDate}`;
    document.getElementById('total-marks').innerText = `Total Marks Obtained: ${totalMarks} / ${maxTotalMarks}`;
}

function retest() {
    resetState();
    populateStudentDropdown();
    displayCompletedStudents();
    showSection('student-selection-container');
}

function generateResultsXLSX() {
    const wb = XLSX.utils.book_new();
    const wsData = answers.map(answer => ({
        Question: answer.question,
        Answer: answer.answer,
        Marks: answer.marks,
        MaxMarks: answer.maxMarks
    }));

    // Create a worksheet from the results data
    const ws = XLSX.utils.json_to_sheet(wsData);
    
    // Add total marks to the results
    const totalRow = ['Total Marks Obtained', '', totalMarks, maxTotalMarks];
    XLSX.utils.sheet_add_aoa(ws, [totalRow], { origin: -1 }); // Add to the end of the sheet

    // Set column widths for better readability
    ws['!cols'] = [
        { wch: 30 }, // Width of 'Question' column
        { wch: 50 }, // Width of 'Answer' column
        { wch: 15 }, // Width of 'Marks' column
        { wch: 15 }, // Width of 'MaxMarks' column
    ];

    // Create a new sheet for total marks
    const wsTotal = XLSX.utils.json_to_sheet([{ 
        TotalMarksObtained: `Total Marks Obtained: ${totalMarks}`,
        MaxMarks: `Total Max Marks: ${maxTotalMarks}`
    }], { header: ['TotalMarksObtained', 'MaxMarks'] });

    // Append the total marks sheet
    XLSX.utils.book_append_sheet(wb, ws, 'Results');
    XLSX.utils.book_append_sheet(wb, wsTotal, 'Summary');

    // Write the file
    XLSX.writeFile(wb, `${studentName}_result_${currentDate}.xlsx`);
}


function resetState() {
    currentQuestionIndex = 0;
    questions = [];
    selectedQuestions = [];
    totalMarks = 0;
    answers.length = 0;
    studentName = '';
    document.getElementById('student-selection').value = '';
    fileInput.value = '';
    clearInterval(timerInterval); // Clear timer
    timerElem.innerText = 'Time Remaining: 10:00'; // Reset timer display
    timeRemaining = examDuration; // Reset time remaining
}

function recordStudentAttendance(name) {
    let attendedStudents = getAttendedStudents();
    attendedStudents.push(name);
    localStorage.setItem('attendedStudents_' + currentDate, JSON.stringify(attendedStudents));
}

function getAttendedStudents() {
    const attended = localStorage.getItem('attendedStudents_' + currentDate);
    return attended ? JSON.parse(attended) : [];
}

function readXLSXFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        try {
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            questions = XLSX.utils.sheet_to_json(worksheet);

            selectQuestions();
            displayQuestion();
        } catch (error) {
            console.error('Error reading questions file:', error);
        }
    };
    reader.readAsArrayBuffer(file);
}

function selectQuestions() {
    selectedQuestions = [];
    let availableQuestions = [...questions];
    let currentMarks = 0;

    // To keep track of questions already selected
    let usedQuestions = new Set();

    // Function to check if we can reach exactly 20 marks with the remaining questions
    function canReach20Marks(currentMarks, remainingQuestions) {
        return remainingQuestions.some(q => currentMarks + q.MaxMarks <= maxTotalMarks);
    }

    while (currentMarks < maxTotalMarks && availableQuestions.length > 0) {
        const validQuestions = availableQuestions.filter(q => !usedQuestions.has(q.Question));
        const remainingMarks = maxTotalMarks - currentMarks;

        if (validQuestions.length === 0) break;

        // Filter questions that can be added to reach exactly 20 marks
        const feasibleQuestions = validQuestions.filter(q => q.MaxMarks <= remainingMarks);

        if (feasibleQuestions.length === 0) break;

        // Randomly select a question from feasible options
        const randomIndex = Math.floor(Math.random() * feasibleQuestions.length);
        const question = feasibleQuestions[randomIndex];

        // Ensure that we don’t exceed the total marks
        if (currentMarks + question.MaxMarks <= maxTotalMarks) {
            selectedQuestions.push(question);
            currentMarks += question.MaxMarks;
            usedQuestions.add(question.Question); // Mark question as used
            availableQuestions = availableQuestions.filter(q => q !== question); // Remove question from available list
        } else {
            break;
        }
    }

    // Check if we reached exactly 20 marks
    if (currentMarks !== maxTotalMarks) {
        console.error('Unable to select questions that total exactly 20 marks.');
        alert('Cannot generate an exam with the total marks exactly 20 with the given questions.');
        resetState();
        showSection('upload-container');
    }
}

function startTimer() {
    timerInterval = setInterval(() => {
        const minutes = Math.floor(timeRemaining / 60000);
        const seconds = Math.floor((timeRemaining % 60000) / 1000);
        timerElem.innerText = `Time Remaining: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            alert('Time is up!');
            displayResults();
        } else {
            timeRemaining -= 1000;
        }
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}
