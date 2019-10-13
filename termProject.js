"use strict"

var gl;

var n = 0; // iterations
var r = 1;
var Theta = 90;
var phi = 90;
var headAngle = 45;
var startLanguage = "F[-[F]][&[F]F][+[F]F]F[*[F]F][F]";
var startBackup = "F[-[F]][&[F]F][+[F]F]F[*[F]F][F]";
var treeVertices = [];

var axis = 1;
var theta = [0,0,0];
var thetaLoc;
var rotate = true;

function toRadians(angle) {
    return angle * (Math.PI / 180);
}

function findLength(vector) {
    return Math.sqrt(((vector[0]*vector[0])) + (vector[1]*vector[1]) + (vector[2]*vector[2]));
}

// function to check if a user input string for a new language is valid
function checkLanguage(str) {
    let re = /^[F*&+\x2D\x5B\x5D]{1,}$/;
    let letterTest = re.test(str);
    let error = "";
    if( !letterTest ) {
        error += "Unknown Character(s), ";
    }

    let lCount = 0;
    let rCount = 0;
    let bracketTest = true;
    for( let i = 0; i < str.length; i++ ) {
        if( str[i] == '[' ) {
            lCount += 1;
        } else if( str[i] == ']' ) {
            rCount += 1;
        }

        if( rCount > lCount ) {
            bracketTest = false;
        }
    }
    if( !bracketTest ) {
        error += "Mismatched Bracket(s), ";
    }

    return [bracketTest && letterTest, error];
}

// creates a new TreeString based on the number of iterations

// some interesting examples of possible languages:
//          "F[+F-[F*F]&F]"
//          "F[---FF][+++FF][&&&FF][***FF]F[---F][+++F][&&&F][***F][F]"
function createTreeString(wholeString, iterations) {
    if( iterations == 0 ) {
        return wholeString;
    }
    wholeString = wholeString.replace(/F/g,startLanguage);
    return createTreeString(wholeString, iterations-1);
}

// takes the newly created TreeString and converts it into
// an array of the tree's vertices
// start = start of tree
// theta/phi = direction which we are "facing" (in degrees)
// headAngle = user defined amount to change theta/phi
// returns array of vertices for the tree
function decodeTreeString(treeString, Theta, phi, headAngle, start, r) {
    let i = 0;
    let current = start;
    let vertices = []; // array of vertices to be returned
    while( i != treeString.length ) {
        // base cases -> F, +, -, &, *
        if( treeString[i] == "F" ) {
            vertices.push(current); // current
            // calculate next by spherical -> cartesian coordinates
            let nextX = current[0] + r * (Math.sin(toRadians(Theta)) * Math.cos(toRadians(phi)));
            let nextY = current[1] + r * (Math.sin(toRadians(Theta)) * Math.sin(toRadians(phi)));
            let nextZ = current[2] + r * Math.cos(toRadians(Theta));
            
            let next = vec3(nextX, nextY, nextZ);
            vertices.push(next); // next
            current = next; // move current position to end of new branch
            i += 1;
        } else if( treeString[i] == "+" ) {
            Theta += headAngle;
            i += 1;
        } else if( treeString[i] == "-" ) {
            Theta -= headAngle;
            i += 1;
        } else if( treeString[i] == "*" ) {
            phi += headAngle;
            i += 1;
        } else if( treeString[i] == "&" ) {
            phi -= headAngle;
            i += 1;
        } else if( treeString[i] == "[") {
            // string to be recursed on
            let recurseString = "";
            i += 1;
            let depth = 1;
            // exit loop once matching bracket is found
            while( depth != 0 ) {
                if( treeString[i] == "[" ) {
                    depth += 1;
                } else if( treeString[i] == "]" ) {
                    depth -= 1;
                }
                recurseString += treeString[i];
                i += 1; 
            }
            // while loop leaves the trailing ']' bracket so 
            // slice used to remove this last bracket to recurse on 
            // interior string
            recurseString = recurseString.slice(0, -1);

            let recurseVertices = decodeTreeString(recurseString, Theta, phi, headAngle, current, r);
            // put together total vertices with vertices from recursion
            vertices = vertices.concat(recurseVertices);
        }
    }
    return vertices;
}

window.onload = function init() {

    var canvas = document.getElementById("gl-canvas");

    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) { alert("WebGL isn't available"); }

    // setup of the 'Language' and 'Angle' overlay on the canvas
    // allows the user to know what the current branch angle and language
    // being used is
    var langElement = document.getElementById("currentLanguage");
    var angleElement = document.getElementById("currentAngle");
    var langNode = document.createTextNode(startLanguage);
    var angleNode = document.createTextNode(headAngle);
    langElement.appendChild(langNode);
    angleElement.appendChild(angleNode);


    // Configure WebGL

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.8, 0.8, 0.8, 1.0);
    gl.enable(gl.DEPTH_TEST);

    // Load shaders and initialize attribute buffers (and compiles the shaders)

    var program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    // Load the data into the GPU

    var bufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferId);
    gl.bufferData(gl.ARRAY_BUFFER, 8 * Math.pow(5, 10), gl.STATIC_DRAW);

    // Associate out shader variables with our data buffer

    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    thetaLoc = gl.getUniformLocation(program, "theta");

    // Event listeners

    document.getElementById("tryInput").onclick = function () {
        // get input from user
        var newLanguage = document.getElementById("languageInput").value;
        // check if user input is valid, if not warn them
        if( newLanguage == "" || newLanguage == " " ) {
            // sets language to original language
            startLanguage = startBackup;
        } else if( !checkLanguage(newLanguage)[0] ) {
            // outputs type of error
            console.log(checkLanguage(newLanguage));
            alert(checkLanguage(newLanguage)[1] + "try again");
            startLanguage = startLanguage;
        } else {
            // new language is valid
            startLanguage = newLanguage;
        }
        langNode.nodeValue = startLanguage;
        calcTree();
        render();
    };

    document.getElementById("toggleRotation").onclick = function() {
        rotate = !rotate;
        calcTree();
        render();
    }

    // change number of iterations
    document.getElementById("iterationSlider").oninput = function(event) { 
        n = event.target.value;
        calcTree();
        render();
    };

    // change the angle between the branches and the stem/trunk
    document.getElementById("branchAngleSlider").oninput = function(event) {
        let newAngle = headAngle - event.target.value;
        if( headAngle > event.target.value ) {
            headAngle -= newAngle;
        } else {
            newAngle = Math.abs(newAngle);
            headAngle += newAngle;
        }
        angleNode.nodeValue = headAngle;
        calcTree();
        render();
    };
    
    calcTree();
    render();
};

// calculates all the vertices of a tree and sends the information to the GPU
// separation from render() so the tree is constantly being recaculated
function calcTree() {
    // resets the treeVertices array each time a new tree is calculated
    treeVertices = [];
    let treeString = createTreeString("F", n);
    treeVertices = decodeTreeString(treeString, Theta, phi, headAngle, vec3(0,0,0), r);
    
    // finds the farthest away point/vertex and scales
    // the tree to fit on the canvas
    let vMax = 0;
    for( let i = 0; i < treeVertices.length; i++ ) {
        vMax = Math.max(vMax, findLength(treeVertices[i]))
    }
    vMax /= 1.6
    for( let j = 0; j < treeVertices.length; j++ ) {
        treeVertices[j] = vec3(
            treeVertices[j][0] / vMax,
            treeVertices[j][1] / vMax - 0.9,
            treeVertices[j][2] / vMax
        );
    }

    gl.bufferSubData(gl.ARRAY_BUFFER, 0, flatten(treeVertices));
}

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    // rotation
    if( rotate ) {
        theta[axis] += 0.01;
        gl.uniform3fv(thetaLoc, theta);
    }

    gl.drawArrays(gl.LINES, 0, treeVertices.length);
    requestAnimFrame(render);
}