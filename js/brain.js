const { THREE } = window

// Neuron ----------------------------------------------------------------

export class Neuron extends THREE.Vector3 {
  constructor (x, y, z) {
    super(x, y, z)

    this.connection = []
    this.recievedSignal = false
    this.lastSignalRelease = 0
    this.releaseDelay = 0
    this.fired = false
    this.firedCount = 0
    this.prevReleaseAxon = null
  }

  connectNeuronTo (neuronB) {
    const neuronA = this
    // create axon and establish connection
    const axon = new Axon(neuronA, neuronB)
    neuronA.connection.push(new Connection(axon, 'A'))
    neuronB.connection.push(new Connection(axon, 'B'))
    return axon
  }

  reset () {
    this.releaseDelay = 0
    this.fired = false
    this.recievedSignal = false
    this.firedCount = 0
  }

  createSignal (particlePool, minSpeed, maxSpeed) {
    this.firedCount += 1
    this.recievedSignal = false

    const signals = []
    // create signal to all connected axons
    for (let i = 0; i < this.connection.length; i++) {
      if (this.connection[i].axon !== this.prevReleaseAxon) {
        const c = new Signal(particlePool, minSpeed, maxSpeed)
        c.setConnection(this.connection[i])
        signals.push(c)
      }
    }
    return signals
  }
}

// Signal ----------------------------------------------------------------

class Signal extends THREE.Vector3 {
  constructor (particlePool, minSpeed, maxSpeed) {
    super()

    this.minSpeed = minSpeed
    this.maxSpeed = maxSpeed
    this.speed = THREE.Math.randFloat(this.minSpeed, this.maxSpeed)
    this.alive = true
    this.t = null
    this.startingPoint = null
    this.axon = null
    this.particle = particlePool.getParticle()
    // THREE.Vector3.call(this)
  }

  setConnection (Connection) {
    this.startingPoint = Connection.startingPoint
    this.axon = Connection.axon
    if (this.startingPoint === 'A') { this.t = 0 } else if (this.startingPoint === 'B') { this.t = 1 }
  }

  travel () {
    if (this.startingPoint === 'A') {
      this.t += this.speed
      if (this.t >= 1) {
        this.t = 1
        this.alive = false
        this.axon.neuronB.recievedSignal = true
        this.axon.neuronB.prevReleaseAxon = this.axon
      }
    } else if (this.startingPoint === 'B') {
      this.t -= this.speed
      if (this.t <= 0) {
        this.t = 0
        this.alive = false
        this.axon.neuronA.recievedSignal = true
        this.axon.neuronA.prevReleaseAxon = this.axon
      }
    }

    const pos = this.axon.getPoint(this.t)
    // pos = this.axon.getPointAt(this.t); // uniform point distribution but slower calculation
    this.particle.set(pos.x, pos.y, pos.z)
  }
}

// Particle Pool ---------------------------------------------------------

class ParticlePool {
  constructor (poolSize) {
    this.spriteTextureSignal = new THREE.TextureLoader().load('sprites/electric.png')

    this.poolSize = poolSize
    this.pGeom = new THREE.Geometry()
    this.particles = this.pGeom.vertices

    this.offScreenPos = new THREE.Vector3(9999, 9999, 9999) // #CM0A r68 Points default frustumCull = true(extended from Object3D), so need to set to 'false' for this to work with oppScreenPos, else particles will dissappear

    this.pColor = 0xff4400
    this.pSize = 0.6

    for (let ii = 0; ii < this.poolSize; ii++) {
      this.particles[ii] = new Particle(this)
    }

    // inner particle
    this.pMat = new THREE.PointsMaterial({
      map: this.spriteTextureSignal,
      size: this.pSize,
      color: this.pColor,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      transparent: true
    })

    this.pMesh = new THREE.Points(this.pGeom, this.pMat)
    this.pMesh.frustumCulled = false // ref: #CM0A

    // const scene = new THREE.Object3D()
    scene.add(this.pMesh)

    // outer particle glow
    this.pMat_outer = new THREE.PointsMaterial({
      map: this.spriteTextureSignal,
      size: this.pSize * 10,
      color: this.pColor,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      transparent: true,
      opacity: 0.025
    })

    this.pMesh_outer = new THREE.Points(this.pGeom, this.pMat_outer)
    this.pMesh_outer.frustumCulled = false // ref:#CM0A

    scene.add(this.pMesh_outer)
  }

  getParticle () {
    for (let ii = 0; ii < this.poolSize; ii++) {
      const p = this.particles[ii]
      if (p.available) {
        p.available = false
        return p
      }
    }
    return null
  }

  update () {
    this.pGeom.verticesNeedUpdate = true
  }

  updateSettings () {
    // inner particle
    this.pMat.color.setHex(this.pColor)
    this.pMat.size = this.pSize
    // outer particle
    this.pMat_outer.color.setHex(this.pColor)
    this.pMat_outer.size = this.pSize * 10
  }
}

// Particle --------------------------------------------------------------
// Private class for particle pool

class Particle extends THREE.Vector3 {
  constructor (particlePool) {
    super()

    this.particlePool = particlePool
    this.available = true
    THREE.Vector3.call(this, particlePool.offScreenPos.x, particlePool.offScreenPos.y, particlePool.offScreenPos.z)
  }

  free () {
    this.available = true
    this.set(this.particlePool.offScreenPos.x, this.particlePool.offScreenPos.y, this.particlePool.offScreenPos.z)
  }
}

// Axon ------------------------------------------------------------------

class Axon extends THREE.CubicBezierCurve3 {
  constructor (neuronA, neuronB) {
    super()

    this.bezierSubdivision = 8
    this.neuronA = neuronA
    this.neuronB = neuronB
    this.cpLength = neuronA.distanceTo(neuronB) / THREE.Math.randFloat(1.5, 4.0)
    this.controlPointA = this.getControlPoint(neuronA, neuronB)
    this.controlPointB = this.getControlPoint(neuronB, neuronA)
    THREE.CubicBezierCurve3.call(this, this.neuronA, this.controlPointA, this.controlPointB, this.neuronB)

    this.geom = new THREE.Geometry()
    this.geom.vertices = this.calculateVertices()
  }

  calculateVertices () {
    return this.getSpacedPoints(this.bezierSubdivision)
  }

  // generate uniformly distribute vector within x-theta cone from arbitrary vector v1, v2
  getControlPoint (v1, v2) {
    const dirVec = new THREE.Vector3().copy(v2).sub(v1).normalize()
    const northPole = new THREE.Vector3(0, 0, 1) // this is original axis where point get sampled
    const axis = new THREE.Vector3().crossVectors(northPole, dirVec).normalize() // get axis of rotation from original axis to dirVec
    const axisTheta = dirVec.angleTo(northPole) // get angle
    const rotMat = new THREE.Matrix4().makeRotationAxis(axis, axisTheta) // build rotation matrix

    const minz = Math.cos(THREE.Math.degToRad(45)) // cone spread in degrees
    const z = THREE.Math.randFloat(minz, 1)
    const theta = THREE.Math.randFloat(0, Math.PI * 2)
    const r = Math.sqrt(1 - z * z)
    const cpPos = new THREE.Vector3(r * Math.cos(theta), r * Math.sin(theta), z)
    cpPos.multiplyScalar(this.cpLength) // length of cpPoint
    cpPos.applyMatrix4(rotMat) // rotate to dirVec
    cpPos.add(v1) // translate to v1
    return cpPos
  }
}

// Connection ------------------------------------------------------------
class Connection {
  constructor (axon, startingPoint) {
    this.axon = axon
    this.startingPoint = startingPoint
  }
}

// Neural Network --------------------------------------------------------

export class NeuralNetwork {
  constructor (config = {}) {
    // settings
    this.verticesSkipStep = 2
    this.maxAxonDist = 8
    this.maxConnectionPerNeuron = 6

    this.currentMaxSignals = 8000
    this.limitSignals = 12000
    this.particlePool = new ParticlePool(this.limitSignals) // *************** ParticlePool must bigger than limit Signal ************

    this.signalMinSpeed = 0.035
    this.signalMaxSpeed = 0.065

    // NN component containers
    this.allNeurons = []
    this.allSignals = []
    this.allAxons = []

    // axon
    this.axonOpacityMultiplier = 1.0
    this.axonColor = 0x0099ff
    // this.axonGeom = new THREE.BufferGeometry()
    this.axonPositions = []
    this.axonIndices = []
    this.axonNextPositionsIndex = 0

    this.shaderUniforms = {
      color: { type: 'c', value: new THREE.Color(this.axonColor) },
      opacityMultiplier: { type: 'f', value: 1.0 }
    }

    this.shaderAttributes = {
      opacityAttr: { type: 'f', value: [] }
    }

    // neuron
    this.neuronSize = 0.7
    this.spriteTextureNeuron = new THREE.TextureLoader().load('sprites/electric.png')
    this.neuronColor = 0x00ffff
    this.neuronOpacity = 1.0
    this.neuronsGeom = new THREE.Geometry()
    this.neuronMaterial = new THREE.PointsMaterial({
      map: this.spriteTextureNeuron,
      size: this.neuronSize,
      color: this.neuronColor,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      transparent: true,
      opacity: this.neuronOpacity
    })

    // info api
    this.numNeurons = 0
    this.numAxons = 0
    this.numSignals = 0

    // initialize NN
    // this.init()
  }

  create (text) {
    // obj loader
    const objLoader = new THREE.OBJLoader()

    const loadedObject = objLoader.parse(text)

    const mesh = loadedObject.children[0]
    const meshVertices = mesh.geometry.vertices

    // set material
    mesh.material = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.05,
      depthTest: false,
      color: 0x0088ff,
      blending: THREE.AdditiveBlending
    })
    // scene.add(loadedObject)

    const neurons = this.initNeurons(meshVertices)
    scene.add(neurons)

    const axonMesh = this.initAxons()

    scene.add(axonMesh)

    return mesh
  }

  // async initSample () {
  //   // obj loader
  //   const objLoader = new THREE.OBJLoader()

  //   const text = await fetch('models/brain_vertex_low.obj').then(e => e.text())
  //   const loadedObject = objLoader.parse(text)

  //   const loadedMesh = loadedObject.children[0]
  //   const loadedMeshVertices = loadedMesh.geometry.vertices

  //   // set material
  //   loadedMesh.material = new THREE.MeshBasicMaterial({
  //     transparent: true,
  //     opacity: 0.05,
  //     depthTest: false,
  //     color: 0x0088ff,
  //     blending: THREE.AdditiveBlending
  //   })
  //   scene.add(loadedObject)

  //   this.initNeurons(loadedMeshVertices)
  //   this.initAxons()

  //   this.initialized = true

  //   return scene
  // }

  initNeurons (inputVertices) {
    for (let i = 0; i < inputVertices.length; i += this.verticesSkipStep) {
      const pos = inputVertices[i]
      const n = new Neuron(pos.x, pos.y, pos.z)
      this.allNeurons.push(n)
      this.neuronsGeom.vertices.push(n)
    }

    // neuron mesh
    this.neuronParticles = new THREE.Points(this.neuronsGeom, this.neuronMaterial)
    return this.neuronParticles
  }

  initAxons () {
    const allNeuronsLength = this.allNeurons.length
    for (let j = 0; j < allNeuronsLength; j++) {
      const n1 = this.allNeurons[j]
      for (let k = j + 1; k < allNeuronsLength; k++) {
        const n2 = this.allNeurons[k]
        // connect neuron if distance ... and limit connection per neuron to not more than x
        const shouldConnect = (n1 !== n2 && n1.distanceTo(n2) < this.maxAxonDist &&
          n1.connection.length < this.maxConnectionPerNeuron &&
          n2.connection.length < this.maxConnectionPerNeuron)
        if (shouldConnect) {
          const connectedAxon = n1.connectNeuronTo(n2)
          this.constructAxonArrayBuffer(connectedAxon)
        }
      }
    }

    // *** attirbute size must bigger than its content ***
    const axonIndices = new window.Uint32Array(this.axonIndices.length)
    const axonPositions = new window.Float32Array(this.axonPositions.length)
    const axonOpacities = new window.Float32Array(this.shaderAttributes.opacityAttr.value.length)

    // transfer temp-array to arrayBuffer
    function transferToArrayBuffer (fromArr = [], toArr = []) {
      for (let i = 0; i < toArr.length; i++) {
        toArr[i] = fromArr[i]
      }
    }
    transferToArrayBuffer(this.axonIndices, axonIndices)
    transferToArrayBuffer(this.axonPositions, axonPositions)
    transferToArrayBuffer(this.shaderAttributes.opacityAttr.value, axonOpacities)

    const axonGeom = new THREE.BufferGeometry()
    // axonGeom.addAttribute('index', new THREE.BufferAttribute(axonIndices, 1))
    axonGeom.setIndex(new THREE.BufferAttribute(axonIndices, 1))
    axonGeom.addAttribute('position', new THREE.BufferAttribute(axonPositions, 3))
    axonGeom.addAttribute('opacityAttr', new THREE.BufferAttribute(axonOpacities, 1))

    // axons mesh
    this.shaderMaterial = new THREE.ShaderMaterial({
      uniforms: this.shaderUniforms,
      // attributes: this.shaderAttributes,
      vertexShader: document.getElementById('vertexshader-axon').textContent,
      fragmentShader: document.getElementById('fragmentshader-axon').textContent,
      blending: THREE.AdditiveBlending,
      // depthTest:      false,
      transparent: true
    })

    const axonMesh = new THREE.Line(axonGeom, this.shaderMaterial, THREE.LineSegments)
    this.axonMesh = axonMesh

    return axonMesh
  }

  demoStep () {
    this.update()

    // reset all neurons and when there is X signal
    if (this.allSignals.length <= 0) {
      this.spark()
    }
  }

  spark () {
    const { allNeurons } = this

    allNeurons.forEach(n => {
      n.reset()
    })
    this.releaseSignalAt(allNeurons[THREE.Math.randInt(0, allNeurons.length)])
  }

  update () {
    const currentTime = Date.now()

    const { allNeurons } = this

    // update neurons state and release signal
    allNeurons.forEach(n => {
      if (this.allSignals.length < this.currentMaxSignals - this.maxConnectionPerNeuron) {
        // currentMaxSignals - maxConnectionPerNeuron because allSignals can not bigger than particlePool size
        if (n.recievedSignal && n.firedCount < 8) { // Traversal mode
        // if (n.recievedSignal && (currentTime - n.lastSignalRelease > n.releaseDelay) && n.firedCount < 8) { // Random mode
        // if (n.recievedSignal && !n.fired) { // Single propagation mode
          n.fired = true
          n.lastSignalRelease = currentTime
          n.releaseDelay = THREE.Math.randInt(100, 1000)
          this.releaseSignalAt(n)
        }
      }

      n.recievedSignal = false // if neuron recieved signal but still in delay reset it
    })

    // update and remove signals
    this.allSignals.forEach((s, index) => {
      s.travel()

      if (!s.alive) {
        s.particle.free()

        this.allSignals.splice(index, 1)
      }
    })

    // update particle pool vertices
    this.particlePool.update()

    // Update stats
    this.updateInfo()
  }

  // add vertices to temp-arrayBuffer, generate temp-indexBuffer and temp-opacityArrayBuffer
  constructAxonArrayBuffer (axon) {
    this.allAxons.push(axon)
    const vertices = axon.geom.vertices
    const numVerts = vertices.length

    // &&&&&&&&&&&&&&&&&&&&&^^^^^^^^^^^^^^^^^^^^^
    // var opacity = THREE.Math.randFloat(0.001, 0.1);
    for (let i = 0; i < numVerts; i++) {
      this.axonPositions.push(vertices[i].x, vertices[i].y, vertices[i].z)

      if (i < numVerts - 1) {
        const idx = this.axonNextPositionsIndex
        this.axonIndices.push(idx, idx + 1)

        const opacity = THREE.Math.randFloat(0.002, 0.2)
        this.shaderAttributes.opacityAttr.value.push(opacity, opacity)
      }

      this.axonNextPositionsIndex += 1
    }
  }

  releaseSignalAt (neuron) {
    if (!neuron) {
      throw new Error('Neuron is required')
    }

    const signals = neuron.createSignal(this.particlePool, this.signalMinSpeed, this.signalMaxSpeed)
    // console.log(signals)
    signals.forEach(s => {
      this.allSignals.push(s)
    })
    return signals
  }

  updateInfo () {
    this.numNeurons = this.allNeurons.length
    this.numAxons = this.allAxons.length
    this.numSignals = this.allSignals.length
  }

  updateSettings () {
    this.neuronMaterial.opacity = this.neuronOpacity
    this.neuronMaterial.color.setHex(this.neuronColor)
    this.neuronMaterial.size = this.neuronSize

    this.shaderUniforms.color.value.set(this.axonColor)
    this.shaderUniforms.opacityMultiplier.value = this.axonOpacityMultiplier

    this.particlePool.updateSettings()
  }
}

/**
 * Setup a basic ThreeJS scene
 * @param {*} config
 * @returns
 */
export function Brain (config = {}) {
  // if (!Detector.webgl) {
  //   Detector.addGetWebGLMessage()
  //   document.getElementById('loading').style.display = 'none' // hide loading animation when finish loading model
  // }

  //   let container, stats
  //   let camera, cameraCtrl, renderer

  // ---- scene
  const container = config.el || document.getElementById('canvas-container')
  const scene = window.scene = new THREE.Scene()

  // ---- camera
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000)
  // camera orbit control
  const cameraCtrl = new THREE.OrbitControls(camera, container)
  cameraCtrl.object.position.y = 150
  cameraCtrl.update()

  // ---- renderer

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
  const w = container.offsetWidth || 500
  const h = container.offsetHeight || 500
  // console.log(w, h)
  renderer.setSize(w, h)
  // renderer.setSize(window.innerWidth, window.innerHeight)
  container.appendChild(renderer.domElement)

  // ---- stats
  // const stats = new Stats()
  // container.appendChild(stats.domElement)

  // ---- scene settings
  const sceneSettings = {
    pause: false,
    bgColor: 0x0d0d0f
  }

  // Neural Net
  // const neuralNet = window.neuralNet = new NeuralNetwork()
  // TODO
  //   scene.add(neuralNet.create())

  const render = () => {}
  function update () {
    // requestAnimationFrame(run)
    renderer.setClearColor(sceneSettings.bgColor, 1)

    if (!sceneSettings.pause) {
      // neuralNet.update()
      // updateGuiInfo()
      render()
    }

    renderer.render(scene, camera)
    // stats.update()
  }
  const animationFrame = new AnimationFrame(update).start()
  // run()

  window.addEventListener('keypress', function (event) {
    if (event.keyCode === 32) { // if spacebar is pressed
      event.preventDefault()
      sceneSettings.pause = !sceneSettings.pause
    }
  })

  window.addEventListener('resize', function onWindowResize () {
    const w = window.innerWidth
    const h = window.innerHeight
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
  }, false)

  return {
    animationFrame,
    scene,
    render,
    $mount (el = '#brain') {
      // TODO lazy mount
    }
  }
}

/**
 * AnimationFrame
 * @example: new AnimationFrame(() => {}).start()
 */
export class AnimationFrame {
  constructor (animate = () => {}, fps = 60) {
    this.requestID = 0
    this.fps = fps
    this.animate = animate
  }

  start () {
    let then = performance.now()
    const interval = 1000 / this.fps

    const animateLoop = (now) => {
      this.requestID = requestAnimationFrame(animateLoop)
      const delta = now - then

      if (delta > interval) {
        then = now - (delta % interval)
        this.animate(delta)
      }
    }
    this.requestID = requestAnimationFrame(animateLoop)
  }

  stop () {
    cancelAnimationFrame(this.requestID)
  }
}
