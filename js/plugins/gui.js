
export function createGUI (neuralNet) {
  // ---------- GUI ----------

  const gui = new dat.GUI()
  gui.width = 300

  const guiInfo = gui.addFolder('Info')
  guiInfo.add(neuralNet, 'numNeurons').name('Neurons')
  guiInfo.add(neuralNet, 'numAxons').name('Axons')
  guiInfo.add(neuralNet, 'numSignals', 0, neuralNet.limitSignals).name('Signals')
  guiInfo.autoListen = false

  const guiSettings = gui.addFolder('Settings')
  guiSettings.add(neuralNet, 'currentMaxSignals', 0, neuralNet.limitSignals).name('Max Signals')
  guiSettings.add(neuralNet.particlePool, 'pSize', 0.2, 2).name('Signal Size')
  guiSettings.add(neuralNet, 'signalMinSpeed', 0.01, 0.1, 0.01).name('Signal Min Speed')
  guiSettings.add(neuralNet, 'signalMaxSpeed', 0.01, 0.1, 0.01).name('Signal Max Speed')
  guiSettings.add(neuralNet, 'neuronSize', 0, 2).name('Neuron Size')
  guiSettings.add(neuralNet, 'neuronOpacity', 0, 1.0).name('Neuron Opacity')
  guiSettings.add(neuralNet, 'axonOpacityMultiplier', 0.0, 5.0).name('Axon Opacity Mult')
  guiSettings.addColor(neuralNet.particlePool, 'pColor').name('Signal Color')
  guiSettings.addColor(neuralNet, 'neuronColor').name('Neuron Color')
  guiSettings.addColor(neuralNet, 'axonColor').name('Axon Color')
  guiSettings.addColor(sceneSettings, 'bgColor').name('Background')

  guiInfo.open()
  guiSettings.open()

  function updateNeuralNetworkSettings () {
    neuralNet.updateSettings()
  }

  for (const i in guiSettings.__controllers) {
    guiSettings.__controllers[i].onChange(updateNeuralNetworkSettings)
  }

  function updateGuiInfo () {
    for (const i in guiInfo.__controllers) {
      guiInfo.__controllers[i].updateDisplay()
    }
  }

  // ---------- end GUI ----------
}
