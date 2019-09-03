// textures for six faces
var tex0;
var tex1;
var tex2;
var tex3;
var tex4;
var tex5;

var gl;
var canvas;

var shaderProgram;

// Create a place to store the texture coords for the mesh
var cubeTCoordBuffer;

// Create a place to store terrain geometry
var cubeVertexBuffer;

// Create a place to store the triangles
var cubeTriIndexBuffer;

// Create ModelView matrix
var mvMatrix = mat4.create();

// Create Projection matrix
var pMatrix = mat4.create();

// Create Normal matrix
var nMatrix = mat3.create();

var mvMatrixStack = [];

// Create a place to store the texture
var cubeImage;
var cubeTexture;

teapot_ready = false;


// For animation
var then =0;
var modelXRotationRadians = degToRad(0);
var modelYRotationRadians = degToRad(0);

// View parameters
var eyePt = vec3.fromValues(0.0,0.0,9.0);
var viewDir = vec3.fromValues(0.0,0.0,-8.0);
var up = vec3.fromValues(0.0,1.0,0.0);
var viewPt = vec3.fromValues(0.0,0.0,0.0);

/**
 * Sends Modelview matrix to shader
 */
function uploadModelViewMatrixToShader() {
	gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
}

/**
 * Sends projection matrix to shader
 */
function uploadProjectionMatrixToShader() {
	gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
}

/**
 * Sends normal matrix to shader
 */
function uploadNormalMatrixToShader() {
    mat3.fromMat4(nMatrix,mvMatrix);
    mat3.transpose(nMatrix,nMatrix);
    mat3.invert(nMatrix,nMatrix);
    gl.uniformMatrix3fv(shaderProgram.nMatrixUniform, false, nMatrix);
}

/*upload our phong lighting option toshader to display*/
function uploadLightsToShader(loc,a,d,s) {
  gl.uniform3fv(shaderProgram.uniformLightPositionLoc, loc);
  gl.uniform3fv(shaderProgram.uniformAmbientLightColorLoc, a);
  gl.uniform3fv(shaderProgram.uniformDiffuseLightColorLoc, d);
  gl.uniform3fv(shaderProgram.uniformSpecularLightColorLoc, s);
}

/*
  upload our view direction vector to shader
*/
function uploadViewDirToShader(){
	gl.uniform3fv(gl.getUniformLocation(shaderProgram, "viewDir"), viewDir);
}

/*
 upload our rotation matrix to shader
*/
function uploadRotateMatrixToShader(rotateMat){
	gl.uniformMatrix4fv(gl.getUniformLocation(shaderProgram, "uRotateMat"), false, rotateMat);
}

/**
 * Pushes matrix onto modelview matrix stack
 */
function mvPushMatrix() {
    var copy = mat4.clone(mvMatrix);
    mvMatrixStack.push(copy);
}


/**
 * Pops matrix off of modelview matrix stack
 */
function mvPopMatrix() {
    if (mvMatrixStack.length == 0) {
    	throw "Invalid popMatrix!";
    }
    mvMatrix = mvMatrixStack.pop();
}

/**
 * Sends projection/modelview/normal matrices to shader
 */
function setMatrixUniforms() {
    uploadModelViewMatrixToShader();
	uploadNormalMatrixToShader();
    uploadProjectionMatrixToShader();
}


/**
 * Translates degrees to radians
 * @param {Number} degrees Degree input to function
 * @return {Number} The radians that correspond to the degree input
 */
function degToRad(degrees) {
	return degrees * Math.PI / 180;
}


/**
 * Creates a context for WebGL
 * @param {element} canvas WebGL canvas
 * @return {Object} WebGL context
 */
function createGLContext(canvas) {
	var names = ["webgl", "experimental-webgl"];
	var context = null;
	for (var i=0; i < names.length; i++) {
		try {
		  context = canvas.getContext(names[i]);
		} catch(e) {}
		if (context) {
		  break;
		}
	}
	if (context) {
		context.viewportWidth = canvas.width;
		context.viewportHeight = canvas.height;
	} else {
		alert("Failed to create WebGL context!");
	}
	return context;
}

/**
* Function to load shader from document
* @param {int} id ID to query for shader program from document
* @return Shader object for program
*/
function loadShaderFromDOM(id) {
	var shaderScript = document.getElementById(id);

	// If we don't find an element with the specified id
	// we do an early exit
	if (!shaderScript) {
		return null;
	}

	// Loop through the children for the found DOM element and
	// build up the shader source code as a string
	var shaderSource = "";
	var currentChild = shaderScript.firstChild;
	while (currentChild) {
		if (currentChild.nodeType == 3) { // 3 corresponds to TEXT_NODE
			shaderSource += currentChild.textContent;
		}
		currentChild = currentChild.nextSibling;
	}

	var shader;
	if (shaderScript.type == "x-shader/x-fragment") {
		shader = gl.createShader(gl.FRAGMENT_SHADER);
	} else if (shaderScript.type == "x-shader/x-vertex") {
		shader = gl.createShader(gl.VERTEX_SHADER);
	} else {
		return null;
	}

	gl.shaderSource(shader, shaderSource);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		alert(gl.getShaderInfoLog(shader));
		return null;
	}
	return shader;
}

/**
due to the fact that we need two shaders for teapot and skybox respectively,
we need this function to determine which shader to use
*/
function chooseShaders(isSkybox){
	gl.uniform1f(gl.getUniformLocation(shaderProgram, "pos_or_neg"), isSkybox);
}

//quaternion variable to handle key
var globalQuat = quat.create();

/**
 * Setup the fragment and vertex shaders
 */
function setupShaders() {
	vertexShader = loadShaderFromDOM("shader-vs");
	fragmentShader = loadShaderFromDOM("shader-fs");

	shaderProgram = gl.createProgram();
	gl.attachShader(shaderProgram, vertexShader);
	gl.attachShader(shaderProgram, fragmentShader);
	gl.linkProgram(shaderProgram);

	if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
		alert("Failed to setup shaders");
	}

	gl.useProgram(shaderProgram);



	//shaderProgram.texCoordAttribute = gl.getAttribLocation(shaderProgram, "aTexCoord");
  //console.log("Tex coord attrib: ", shaderProgram.texCoordAttribute);
  //gl.enableVertexAttribArray(shaderProgram.texCoordAttribute);

	//  vertex position manipulation
	shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
	console.log("Vertex attrib: ", shaderProgram.vertexPositionAttribute);
	gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);
//normal manipulation
    shaderProgram.vertexNormalAttribute = gl.getAttribLocation(shaderProgram, "aVertexNormal");
		console.log("Vertex attrib: ", shaderProgram.vertexPositionAttribute);
    gl.enableVertexAttribArray(shaderProgram.vertexNormalAttribute);

	// matrix works here
	shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
	shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");

	// we use Phong Shading here, basically code from mp2
  shaderProgram.nMatrixUniform = gl.getUniformLocation(shaderProgram, "uNMatrix");
	shaderProgram.uniformLightPositionLoc = gl.getUniformLocation(shaderProgram, "uLightPosition");
	shaderProgram.uniformAmbientLightColorLoc = gl.getUniformLocation(shaderProgram, "uAmbientLightColor");
	shaderProgram.uniformDiffuseLightColorLoc = gl.getUniformLocation(shaderProgram, "uDiffuseLightColor");
	shaderProgram.uniformSpecularLightColorLoc = gl.getUniformLocation(shaderProgram, "uSpecularLightColor");
}



/**
* Function to set camera location and viewing direction, as well as facilitate the rending of the
*   skybox and teapot for each animation frame
* @return None
*/
function draw() {
    var transformVec = vec3.create();


    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // We'll use perspective
    mat4.perspective(pMatrix,degToRad(90), gl.viewportWidth / gl.viewportHeight, 0.1, 200.0);




    mvPushMatrix();
	  var rotateMat = mat4.create();
	  mat4.rotateY(rotateMat, rotateMat, modelYRotationRadians);
	  uploadRotateMatrixToShader(rotateMat);
    vec3.set(transformVec,0.0,0.0,-9.0);
    mat4.translate(mvMatrix, mvMatrix,transformVec);
    setMatrixUniforms();
		vec3.add(viewPt, eyePt, viewDir);
		mat4.lookAt(mvMatrix,eyePt,viewPt,up);


	// upload light option to shader
	uploadLightsToShader([0,20,0],[0.3,0.3,0.3],[0.2,0.2,0.2],[0.4,0.4,0.4]);

	// render the skybox
    drawcube();
	// if the teapot has been successfully read in, render the teapot
	if (teapot_ready){
		mat4.rotateY(mvMatrix,mvMatrix,modelYRotationRadians);
		drawTeapot();
	}
    mvPopMatrix();

}

/**
 * Animation to be called from tick. Updates global rotation values.
 */
function animate() {
	if (then==0)
	{
			then = Date.now();
	}
	else
	{
			now=Date.now();
			// Convert to seconds
			now *= 0.0008;
			// Subtract the previous time from the current time
			var deltaTime = now - then;
			// Remember the current time for the next frame.
			then = now;

			//Animate the rotation
		 // modelXRotationRadians += 1.2 * deltaTime;
		//	modelYRotationRadians += 0.7 * deltaTime;
	}
}

/**
* this function aims to setup  cubemap texture for the skybox
*/
function setupCubeMap() {
    // Initialize the Cube Map, and set its parameters
    cubeTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeTexture);
  gl.texImage2D(gl.TEXTURE_CUBE_MAP, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 255, 255]));
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER,
				gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER,
		    gl.LINEAR);

    // Load up each cube map face
    loadCubeMapFace(gl, gl.TEXTURE_CUBE_MAP_POSITIVE_X,
          cubeTexture, 'posx.jpg');
    loadCubeMapFace(gl, gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
         cubeTexture, 'negx.jpg');
    loadCubeMapFace(gl, gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
        cubeTexture, 'posy.jpg');
    loadCubeMapFace(gl, gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
       cubeTexture, 'negy.jpg');
    loadCubeMapFace(gl, gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
       cubeTexture, 'posz.jpg');
    loadCubeMapFace(gl, gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
       cubeTexture, 'negz.jpg');


}


/*
function to display mesh onto our cube map
*/
function loadCubeMapFace(gl, target, texture, url){
    var image = new Image();
    image.onload = function()
    {
			 gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    	gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
        gl.texImage2D(target, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    }
    image.src = url;
}

/**
 * @param {number} value Value to determine whether it is a power of 2
 * @return {boolean} Boolean of whether value is a power of 2
 */
function isPowerOf2(value) {
	return (value & (value - 1)) == 0;
}




function setupBuffers() {

  // Create a buffer for the cube's vertices.
  cubeVertexBuffer = gl.createBuffer();

  // Select the cubeVerticesBuffer as the one to apply vertex
  // operations to from here out.
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexBuffer);

  // Now create an array of vertices for the cube.
  var vertices = [
    // we usde data from coursewebsite times 100
    // Front face
    -100.0, -100.0,  100.0,
     100.0, -100.0,  100.0,
     100.0,  100.0,  100.0,
    -100.0,  100.0,  100.0,

    // Back face
    -100.0, -100.0, -100.0,
    -100.0,  100.0, -100.0,
     100.0,  100.0, -100.0,
     100.0, -100.0, -100.0,

    // Top face
    -100.0,  100.0, -100.0,
    -100.0,  100.0,  100.0,
     100.0,  100.0,  100.0,
     100.0,  100.0, -100.0,

    // Bottom face
    -100.0, -100.0, -100.0,
     100.0, -100.0, -100.0,
     100.0, -100.0,  100.0,
    -100.0, -100.0,  100.0,

    // Right face
     100.0, -100.0, -100.0,
     100.0,  100.0, -100.0,
     100.0,  100.0,  100.0,
     100.0, -100.0,  100.0,

    // Left face
    -100.0, -100.0, -100.0,
    -100.0, -100.0,  100.0,
    -100.0,  100.0,  100.0,
    -100.0,  100.0, -100.0
  ];


  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  // Build the element array buffer; this specifies the indices
    // into the vertex array for each face's vertices.

  cubeTriIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeTriIndexBuffer);
  // This array defines each face as two triangles, using the
   // indices into the vertex array to specify each triangle's
   // position.

  var cubeVertexIndices = [
    0,  1,  2,      0,  2,  3,    // front
    4,  5,  6,      4,  6,  7,    // back
    8,  9,  10,     8,  10, 11,   // top
    12, 13, 14,     12, 14, 15,   // bottom
    16, 17, 18,     16, 18, 19,   // right
    20, 21, 22,     20, 22, 23    // left
  ]

// Now send the element array to GL
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(cubeVertexIndices), gl.STATIC_DRAW);
}

// helper function called by draw() to our cube which is skybox
function drawcube(){
  chooseShaders(true);

  //for vectices
	gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexBuffer);
	gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);

 //for normal
	gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexBuffer);
	gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, 3, gl.FLOAT, false, 0, 0);


	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeTexture);
	gl.uniform1i(gl.getUniformLocation(shaderProgram, "uSampler"), 0);


	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeTriIndexBuffer);
	setMatrixUniforms();
	//draw the data to display
	gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
}
// texture for each faces
var tex0;
var tex1;
var tex2;
var tex3;
var tex4;
var tex5;

/////////////////////////////////////////

// Global buffers used to render teapot
var teapotVertexBuffer;
var teapotVertexNormalBuffer;
var teapotTriIndexBuffer;

/*
parsing function to read obj file
deal with v and f in different ways
*/
function loadobj(string){

	 var lines = string.split("\n");
  var positions = [];
  var normals = [];
  var vertices = [];
    var norm = [];
    count_vertices = 0;
  	count_faces = 0;

  for ( var i = 0 ; i < lines.length ; i++ ) {
    var parts = lines[i].trimRight().split(' ');
    if ( parts.length > 0 ) {
      switch(parts[0]) {
        case 'v': // if start with v(vertex)
               positions.push(parseFloat(parts[1]));
              positions.push(parseFloat(parts[2]));
              positions.push(parseFloat(parts[3]));
             norm.push(0); //initialize normal array
              norm.push(0);
              norm.push(0);
              count_vertices += 1;


          break;

        case 'f'://if start with f (face)
            vertices.push(parseInt(parts[2])-1);
              vertices.push(parseInt(parts[3])-1);
              vertices.push(parseInt(parts[4])-1);
              count_faces += 1;
              break;
      }
    }
  }


    console.log()

	// bind vertex data
	teapotVertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, teapotVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
	teapotVertexBuffer.numItems = count_vertices;



	setNorms(vertices, positions, norm);

	// bind normal data
	teapotVertexNormalBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, teapotVertexNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(norm), gl.STATIC_DRAW);
    teapotVertexNormalBuffer.itemSize = 3;
    teapotVertexNormalBuffer.numItems = count_faces;

	// bind face data
    teapotTriIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, teapotTriIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(vertices), gl.STATIC_DRAW);
	teapotTriIndexBuffer.numItems = count_faces;

	// determine if teapot is ready to be rendered
	teapot_ready = true;
}

//helper function to draw the teapot called by draw()
function drawTeapot(){
	chooseShaders(false);
	uploadViewDirToShader()

	// Draw the cube by binding the array buffer to the cube's vertices
	// array, setting attributes, and pushing it to GL.
	gl.bindBuffer(gl.ARRAY_BUFFER, teapotVertexBuffer);
	gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);

	gl.bindBuffer(gl.ARRAY_BUFFER, teapotVertexNormalBuffer);
	gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, 3, gl.FLOAT, false, 0, 0);

	// Draw the cube.
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, teapotTriIndexBuffer);
	setMatrixUniforms();
	gl.drawElements(gl.TRIANGLES, 6768, gl.UNSIGNED_SHORT, 0);
}

//calculate normal and put data in normalAray (directly used from mp2)
function setNorms(faceArray, vertexArray, normalArray)
{
    console.log(faceArray);
    console.log(vertexArray);
    for(var i=0; i<faceArray.length;i+=3)
    {
        //find the face normal
        var vertex1 = vec3.fromValues(vertexArray[faceArray[i]*3],vertexArray[faceArray[i]*3+1],vertexArray[faceArray[i]*3+2]);

        var vertex2 = vec3.fromValues(vertexArray[faceArray[i+1]*3],vertexArray[faceArray[i+1]*3+1],vertexArray[faceArray[i+1]*3+2]);

        var vertex3 = vec3.fromValues(vertexArray[faceArray[i+2]*3],vertexArray[faceArray[i+2]*3+1],vertexArray[faceArray[i+2]*3+2]);

        var vect31=vec3.create(), vect21=vec3.create();
        vec3.sub(vect21,vertex2,vertex1);
        vec3.sub(vect31,vertex3,vertex1)
        var v=vec3.create();
        vec3.cross(v,vect21,vect31);

        //add the face normal to all the faces vertices
        normalArray[faceArray[i]*3  ]+=v[0];
        normalArray[faceArray[i]*3+1]+=v[1];
        normalArray[faceArray[i]*3+2]+=v[2];

        normalArray[faceArray[i+1]*3]+=v[0];
        normalArray[faceArray[i+1]*3+1]+=v[1];
        normalArray[faceArray[i+1]*3+2]+=v[2];

        normalArray[faceArray[i+2]*3]+=v[0];
        normalArray[faceArray[i+2]*3+1]+=v[1];
        normalArray[faceArray[i+2]*3+2]+=v[2];

    }

    //normalize each vertex normal
    for(var i=0; i<normalArray.length;i+=3)
    {
        var v = vec3.fromValues(normalArray[i],normalArray[i+1],normalArray[i+2]);
        vec3.normalize(v,v);

        normalArray[i  ]=v[0];
        normalArray[i+1]=v[1];
        normalArray[i+2]=v[2];
    }
console.log(normalArray);
    //return the vertex normal

}




// for user interface purpose
//to rotate the teapot

function roll(rate, rotAxis){
    // create a new quaternion to apply new rotation
    var tempQuat = quat.create();
    quat.setAxisAngle(tempQuat, rotAxis, rate);
		// normalize the plane
    quat.normalize(tempQuat, tempQuat);

    // enable the rotation and normalize again
    quat.multiply(globalQuat, tempQuat, globalQuat);
    quat.normalize(globalQuat, globalQuat);
}

/**
this function tell user how to control teapot and eyepoint by pressing different keys
*/
function handleKeyDown(event){
  var originalUp = vec3.fromValues(0.0, 1.0, 0.0);
  var originalEyePt = vec3.fromValues(0.0,0.0,9.0);
	// left arrow key
    if (event.keyCode == 37){

        roll(-0.1, originalUp);

    vec3.transformQuat(eyePt, originalEyePt, globalQuat);
		vec3.normalize(viewDir, eyePt);
		vec3.scale(viewDir, viewDir, -1);
    }
    // right arrow key
    else if (event.keyCode == 39){

        roll(0.1, originalUp);

    vec3.transformQuat(eyePt, originalEyePt, globalQuat);
		vec3.normalize(viewDir, eyePt);
		vec3.scale(viewDir, viewDir, -1);
    }
	//  spin teapot right (eyepoint)
	else if (event.keyCode == 38){
		modelYRotationRadians += 0.1;
	}
	//  spin teapot left (eyepoint)
	else if (event.keyCode == 40){
		modelYRotationRadians -= 0.1;
	}
}




/**
 * Gets a file from the server for processing on the client side.
 *
 * @param  file A string that is the name of the file to get
 * @param  callbackFunction The name of function (NOT a string) that will receive a string holding the file
 *         contents.
 *
 */

function readTextFile(file, callbackFunction)
{
    console.log("reading "+ file);
    var rawFile = new XMLHttpRequest();
    var allText = [];
    rawFile.open("GET", file, true);

    rawFile.onreadystatechange = function ()
    {
        if(rawFile.readyState === 4)
        {
            if(rawFile.status === 200 || rawFile.status == 0)
            {
                 callbackFunction(rawFile.responseText);
                 console.log("Got text file!");

            }
        }
    }
    rawFile.send(null);
}

/**
function to start the program
*/
function startup() {
	canvas = document.getElementById("myGLCanvas");
	gl = createGLContext(canvas);
	gl.clearColor(0.0, 0.0, 0.0, 1.0);
	gl.enable(gl.DEPTH_TEST);
  console.log("test");
	// set up event listener for keystrokes
	document.onkeydown = handleKeyDown;

	// setup pipeline to be able to render scene
	setupShaders();

	setupBuffers();
	readTextFile("teapot_0.obj", loadobj);

	setupCubeMap();

	tick();
}

/**
 * Tick called for every animation frame.
 */
function tick() {
    requestAnimFrame(tick);

    draw();
    animate();
}
