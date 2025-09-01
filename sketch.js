document.addEventListener('DOMContentLoaded', function() {
    const startButton = document.getElementById('start-button');
    const galleryButton = document.getElementById('gallery-button');
    const galleryInput = document.getElementById('gallery-input');
    const homeScreen = document.getElementById('home-screen');
    const scannerScreen = document.getElementById('scanner-screen');
    const reloadButton = document.getElementById('reload-button');

    if (!startButton) {
        console.error("Start Button not found!");
    }

    startButton.addEventListener('click', () => {
        // Hide home screen and show scanner screen
        homeScreen.style.display = 'none';
        scannerScreen.style.display = 'block'; // Directly display the scanner screen
        startCamera(); // Initialize camera
    });

    if (galleryButton && galleryInput) {
        galleryButton.addEventListener('click', () => {
            galleryInput.click(); // Trigger the file input when the gallery button is clicked
        });

        galleryInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                processGalleryImage(file); // Function to handle image selection
            }
        });
    }

    if (reloadButton) {
        reloadButton.addEventListener('click', () => {
            location.reload(); // This will reload the current page
        });
    } else {
        console.error("Reload button not found!");
    }

});

let cameraInput;
let capturedImage;
let extractedTextElement;
let harmfulIngredientsData = {}; // To store harmful ingredients data

// Load the harmful ingredients JSON data
fetch('ingredients.json')
    .then(response => response.json())
    .then(data => {
        harmfulIngredientsData = data.harmfulIngredients; // Store the harmful ingredients
    })
    .catch(error => {
        console.error("Error loading ingredients JSON:", error);
    });

function setup() {
    noCanvas(); // We don't need a canvas for the video feed
    extractedTextElement = document.getElementById('extracted-text');
}

function startCamera() {
    const constraints = {
        video: {
            facingMode: { exact: "environment" } // Use back camera
        }
    };

    navigator.mediaDevices.getUserMedia(constraints)
        .then(function(stream) {
            cameraInput = createCapture(VIDEO);
            cameraInput.size(400, 300);
            cameraInput.parent('video-container'); // Attach video to a div in HTML
            cameraInput.elt.srcObject = stream;

            const scanButton = document.getElementById('scan-button');
            const editButton = document.getElementById('edit-button');
            const saveButton = document.getElementById('save-button');

            if (scanButton) {
                scanButton.addEventListener('click', () => {
                    captureImage();
                });
            } else {
                console.error("Scan button not found!");
            }

            if (editButton) {
                editButton.addEventListener('click', () => {
                    enableEditing();
                });
            } else {
                console.error("Edit button not found!");
            }

            if (saveButton) {
                saveButton.addEventListener('click', () => {
                    saveChanges();
                });
            } else {
                console.error("Save button not found!");
            }
        })
        .catch(function(error) {
            console.error("Error accessing the camera:", error);
        });
}

function captureImage() {
    let captureCanvas = createGraphics(400, 300);
    captureCanvas.image(cameraInput, 0, 0, 400, 300);

    let capturedImageDiv = document.getElementById('captured-image');
    capturedImageDiv.innerHTML = '';
    let imageElement = createImg(captureCanvas.canvas.toDataURL(), "Captured Image");
    capturedImageDiv.appendChild(imageElement.elt);

    extractTextFromImage(captureCanvas.canvas);
}

function processGalleryImage(file) {
    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.src = event.target.result;
        img.onload = function() {
            const width = img.width;
            const height = img.height;

            // Create a p5 canvas with the same size as the loaded image
            const canvas = createGraphics(width, height);
            
            // Draw the image onto the p5 canvas
            canvas.drawingContext.drawImage(img, 0, 0, width, height);

            // Show the captured image
            let capturedImageDiv = document.getElementById('captured-image');
            capturedImageDiv.innerHTML = '';
            let imageElement = createImg(canvas.canvas.toDataURL(), "Selected Image");
            capturedImageDiv.appendChild(imageElement.elt);

            // Extract text from the canvas
            extractTextFromImage(canvas.canvas);
        };
    };
    reader.readAsDataURL(file);
}



function extractTextFromImage(imageCanvas) {
    Tesseract.recognize(imageCanvas, 'eng', { logger: m => console.log(m) })
        .then(result => {
            const extractedText = result.data.text;
            displayExtractedText(extractedText);
            checkHarmfulIngredients(extractedText);
        })
        .catch(error => {
            console.error("Error during text extraction:", error);
        });
}

function displayExtractedText(text) {
    extractedTextElement.value = text;
}

function checkHarmfulIngredients(extractedText) {
    // Step 1: Clean and preprocess the extracted text
    const cleanedText = extractedText
        .toLowerCase() // Convert text to lowercase
        .replace(/[^\w\s]/g, '') // Remove punctuation
        .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
        .trim(); // Trim leading/trailing spaces

    // Step 2: Split the cleaned text into individual words (ingredients)
    const words = cleanedText.split(' ');

    // Step 3: Filter out common words that are not ingredients
    const ignoredWords = new Set(['and', 'or', 'with', 'sugar', 'salt', 'water']); // You can expand this list
    const filteredWords = words.filter(word => !ignoredWords.has(word));

    // Step 4: Map of synonyms or alternative names for ingredients
    const synonymMap = {
        'vitamin c': 'ascorbic acid',
        'e300': 'ascorbic acid',
        'e330': 'citric acid',
        // Add more synonyms or E-number mappings if needed
    };

    const foundDiseases = new Set(); // Use a Set to avoid duplicates

    // Step 5: Check for harmful ingredients in both single words and bigrams (two-word pairs)
    for (let i = 0; i < filteredWords.length; i++) {
        let singleWord = filteredWords[i];
        let bigram = (i < filteredWords.length - 1) ? filteredWords[i] + ' ' + filteredWords[i + 1] : null;

        // Map synonyms or check direct words
        let ingredientSingle = synonymMap[singleWord] || singleWord;
        let ingredientBigram = bigram ? (synonymMap[bigram] || bigram) : null;

        // Check for harmful single words
        if (harmfulIngredientsData[ingredientSingle]) {
            harmfulIngredientsData[ingredientSingle].diseases.forEach(disease => foundDiseases.add(disease));
        }

        // Check for harmful two-word phrases (bigrams)
        if (ingredientBigram && harmfulIngredientsData[ingredientBigram]) {
            harmfulIngredientsData[ingredientBigram].diseases.forEach(disease => foundDiseases.add(disease));
        }
    }

    // Step 6: Display results using SweetAlert with options for "OK" and "Show Risks"
    if (foundDiseases.size > 0) {
        Swal.fire({
            icon: 'error', // Red X mark
            title: 'Harmful ingredients detected!',
            text: 'Click "Show Risks" to see the potential risks, or "OK" to close.',
            showCancelButton: true,
            confirmButtonText: 'Show Risks',
            cancelButtonText: 'OK',
        }).then((result) => {
            if (result.isConfirmed) {
                // User clicked on "Show Risks"
                Swal.fire({
                    icon: 'warning',
                    title: 'Potential risks identified:',
                    text: Array.from(foundDiseases).join(', '),
                    confirmButtonText: 'OK'
                });
            }
        });
    } else {
        Swal.fire({
            icon: 'success', // Green tick mark
            title: 'No harmful ingredients detected.',
            confirmButtonText: 'OK'
        });
    }
}


function enableEditing() {
    const textarea = document.getElementById('extracted-text');
    textarea.readOnly = false;
    document.getElementById('edit-button').style.display = 'none';
    document.getElementById('save-button').style.display = 'inline';
}

function saveChanges() {
    const textarea = document.getElementById('extracted-text');
    const editedText = textarea.value;

    localStorage.setItem('editedExtractedText', editedText);

    textarea.readOnly = true;
    document.getElementById('edit-button').style.display = 'inline';
    document.getElementById('save-button').style.display = 'none';

    checkHarmfulIngredients(editedText);
}
