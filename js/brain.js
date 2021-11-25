  async initNeuralNetwork () {
    const objLoader = new THREE.OBJLoader()
    const text = await fetch('models/brain_vertex_low.obj').then(e => e.text())
    const loadedObject = objLoader.parse(text)

    const loadedMesh = loadedObject.children[0]
    const loadedMeshVertices = loadedMesh.geometry.vertices
    this.initNeurons(loadedMeshVertices)
    this.initAxons()
    this.initialized = true
