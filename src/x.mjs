import {ProjectEditor} from './view/project-editor.mjs'
import {ModuleEditor} from './view/module-editor.mjs'
import {NodeEditor} from './view/node-editor.mjs'
import {NodeView} from './view/node-view.mjs'
import {setupHideables} from './view/hideable.mjs'
//import Nodel from '../lib/nodel.min.mjs'
import Nodel from 'nodel'

var state

function main() {
  // create hideables
  setupHideables()

  // setup nodel framework
  const nr = new Nodel.Renderer()
  const nm = new Nodel.Manager(nr)
  const nl = new Nodel.Listener(nr, nm)

  // aggregate state
  state = {
    selected: {
      template: {name: 'basic', code: '() => null', template: 'basic'},
      node: null,
    },
    nodel: {
      render: nr,
      manager: nm,
      listener: nl,
    },

    // html elements by custom key
    elem: {
      nodel: document.getElementById('nodel'),
      help: document.getElementById("help")
    },

    // views and controllers by custom key
    view: {},
    editor: {},
    manager: {},
    util: {},
  }

  // load ui elements
  state.editor.project = new ProjectEditor(state)
  state.editor.module = new ModuleEditor(state)
  state.editor.node = new NodeEditor(state)
  state.view.node = new NodeView(state)
}

window.onload = main
window.state = state
