'use strict';

class NodeEditor {
  constructor(state) {
    this.state = state
    this.state.editor.node = this

    // load ui elements
    this.state.elem = {
      ...this.state.elem,
      editor: document.getElementById('editor'),
      // semantics
      nameIndicator: document.getElementById('name'),
      nameInput: document.getElementById('name-input'),
      // program
      codeContainer: document.getElementById('code-container'),
      codeArea: document.getElementById('code'),
      codeOutput: document.getElementById('code-output'),
      nodeResultContainer: document.getElementById('node-result-container'),
      nodeRunIdLabel: document.getElementById('node-run-id'),
      nodeInputArea: document.getElementById('node-input'),
      nodeResultArea: document.getElementById('node-result'),
      totalResultContainer: document.getElementById('total-result-container'),
      totalRunIdLabel: document.getElementById('total-run-id'),
      totalResultArea: document.getElementById('total-result'),
      // actions
      collapseButton: document.getElementById('collapse'),
      runButton: document.getElementById('run'),
      saveButton: document.getElementById('save'),
      deleteButton: document.getElementById('delete'),
    }
    const elems = this.state.elem

    // create dependencies
    this.runner = new CodeRunner(this.state)
    this.state.util.linter = new Linter(
      elems.codeArea,
      elems.codeOutput,
    )

    // NOTE: I think anonymous callbacks are needed to use class state; ie 'this'
    this.state.manager.node = new NodeManager(this.state, {
      // TODO you could make the node manager emit events, 
      // so that the parts could sub themselves.
      // That said, youu should probably also be subbing to events
      // in node manager instead of passing callbacks into the constructor.
      selectNode: (...args) => this.selectNode(...args),
      deselectNode: (...args) => this.deselectNode(...args),
      selectAnything: () => this.show(),
      selectNothing: () => this.hide(),
    })

    // class state
    this.editingName = false

    //
    // ACTIONS

    // collapse the node group
    elems.collapseButton.onclick = () => {
      const node = this.state.selected.node
      this.state.nodel.manager.toggleGroup(node.id)
    }

    // run the code
    elems.runButton.onclick = () => this.runCode(this.state.selected.node)

    // save the code
    elems.saveButton.onclick = () => {
      // save the node and/or node group
      const node = this.state.selected.node
      this.state.manager.module.save(node)
    }
    
    // remove the node
    elems.deleteButton.onclick = () => {
      const node = this.state.selected.node
      // reset the editor
      this.deselectNode(node)
      this.hide()
      // delete the node
      this.state.selected.node = null
      this.state.manager.node.removeNode(node)
    }

    //
    // INTERACTIONS

    // edit node name
    elems.nameIndicator.addEventListener("click", () => {
      this.editName(true)
    })
    elems.nameInput.addEventListener("keyup", e => {
      this.saveName()
      this.updateName(this.state.elem.nameInput.value)

      if (e.key === 'Enter') {
        this.editName(false)
      }
    })

    // update the selected nodes code whenever the area is updated
    elems.codeArea.addEventListener('input', e => {
      this.updateCode(e.target.value)
    })

    // catch tab characters
    elems.codeArea.onkeydown = (e) => {
      if (e.key === 'Tab') {
        e.target.value += '  '
        this.updateCode(e.target.value)
        return false
      }
    }
    
    // listen for changes
    this.state.nodel.manager.onDraw(() => {
      this.selectNode(this.state.selected.node)
    })
  }

  //
  // HELPERS
  updateCode(code) {
    const node = this.state.selected.node
    // update the node's code and params
    node.data.code = code
    node.data.params = ParseJS.parseParams(code)
    // redraw
    this.state.nodel.manager.redraw()
  }

  //
  // EDITOR INTERACTIONS

  deselectNode(node) {
    // indicate deselected node
    const elem = document.getElementById(node.id)
    if (elem) {
      elem.classList.remove('selected')
      console.info(`Deselecting ${node.id}`)
    }
  }

  selectNode(node) {
    if (!node) {
      return
    }

    // indicate selected node
    const selectedElem = document.getElementById(node.id)
    const elems = this.state.elem
    selectedElem.classList.add('selected')

    // render groups differently
    if (node.isGroup(true)) {
      elems.codeContainer.hidden = true
    } else {
      // load a node's code
      elems.codeContainer.hidden = false

      // fix the references
      const refs = ParseJS.splitByCalls(
        node.data.code, (moduleId) => {
          return this.state.manager.module.get(moduleId)?.params
        })
      switch (refs.length) {
        case 1:
          elems.codeArea.value = node.data.code 
          this.state.util.linter.lint()
          break;
        default:
          // split the node by its code references to other nodes
          this.refactorNode(node, refs)
          console.error('TODO')
    
          // collapse the node in to a group
          //this.state.nodel.manager.toggleGroup(node.id)

          // reselect the group
          //this.selectNode(node)
          break;
      }
    }

    this.updateName()
    this.updateCollapsedButton(node)
    this.updateNodeResult(node)
    
    console.info(`Selecting ${node.id}`)
  }

  refactorNode(node, refs) {
    const nodelManager = this.state.nodel.manager

    // pause drawing
    nodelManager.pauseDraw()

    // y offset of nodes to be added
    const yOffset = 300
    const rootNodeId = node.id

    // init the next node
    let nextNode = node
    nextNode.data.code = refs[0].code

    // create a node for each code part
    for (const [refIdx, ref] of Object.entries(refs)) {
      let count = Number(refIdx) + 1
      // add the references module
      if (ref.name) {
        const module = this.state.manager.module.get(ref.name)

        // create the reference node
        const refNodeId = nodelManager.addNode(
          module.base, node.x, node.y + yOffset * count - yOffset/2, module.data())

        // connect the node to the reference node
        this.connectAll(nextNode.id, refNodeId, module.params)

        if (ref.code.trim()) {
          // create the next node
          const nextCode = refs[count].code
          const prevNodeId = nextNode.id 
          const nextNodeId = nodelManager.addNode(
            node.template, node.x, node.y + yOffset * count, {
            name: `${node.data.name} #${count++}`,
            code: nextCode,
            params: ParseJS.parseParams(nextCode)
          })

          // update the next node
          nextNode = nodelManager.nodes[nextNodeId]

          // connect the previous and next nodes
          this.connectAll(prevNodeId, nextNode.id, nextNode.data.params)

          // connect the reference to the next node
          nodelManager.toggleConnect(refNodeId, nextNode.id)
        }
      }
    }
    
    // continue drawing
    nodelManager.unpauseDraw()
  }

  connectAll(fromId, toId, params) {
    const totalParams = params.required.length + params.optional.length
    for (let paramIdx=1; paramIdx<totalParams; paramIdx++) {
      this.state.nodel.manager.toggleConnect(fromId, toId, paramIdx-1)
    }
  }

  show() {
    // show the editor
    editor.show('flex')
  }

  hide() {
    const elem = state.elem

    // hide editor and reset editor elements
    elem.editor.hide()
    elem.codeArea.value = ''
    elem.nameIndicator.innerHTML = ''
    this.state.util.linter.lint('')
  }

  //
  // PROGRAM

  runCode(node) {
    if (!node) {
      console.error("No start node selected")
      return
    }

    // collect state
    const totalResultArea = this.state.elem.totalResultArea
    this.runner.reset()
    const responses = this.runner.run(node)

    // render 
    let responseText = ""
    for (const res of responses) {
      // prevent circular reference
      responseText += JSON.stringify(res,
        Helper.replaceCircularReference()) + "\n"
    }
    this.updateTotalResult(node.data.runId, responseText)
    this.updateNodeResult(node)
  }

  updateTotalResult(runId, result) {
    const totalResultContainer = this.state.elem.totalResultContainer
    const totalRunIdLabel = this.state.elem.totalRunIdLabel
    const totalResultArea = this.state.elem.totalResultArea
    totalRunIdLabel.innerText = `program ${runId}`
    totalResultArea.value = result
    totalResultContainer.show()
  }

  updateNodeResult(node) {
    const elems = this.state.elem
    if (node.data.result === undefined) {
      elems.nodeResultContainer.hide()
    } else {
      elems.nodeRunIdLabel.innerText = `deamon ${node.data.runId}`
      elems.nodeInputArea.value = '' + JSON.stringify(
        node.data.input, Helper.replaceCircularReference())
      elems.nodeResultArea.value = '' + JSON.stringify(
        node.data.result, Helper.replaceCircularReference())
      elems.nodeResultContainer.show()
    }
  }

  //
  // NAME INTERACTIONS

  editName(editing) {
    const elems = this.state.elem
    const node = this.state.selected.node
    const nodeElem = document.getElementById(this.state.selected.node.id)
    const input = elems.nameInput
    const label = elems.nameIndicator

    // update the state
    this.editingName = editing

    if (this.editingName) {
      input.value = label.innerText
      input.show()
      label.hide()
      // focus on the input
      input.focus()
      // move cursor to end of line
      input.setSelectionRange(input.value.length, input.value.length)
    } else {
      const name = input.value
      input.hide()
      label.show()
    }
  }

  resetEditName() {
    // update name field when clicked off input
    if (this.editingName) {
      this.saveName()
      this.updateName(this.state.elem.nameInput.value)
      this.editName(false)
    }
  }

  updateName(name=null) {
    // use the selected node by default
    const node = this.state.selected.node
    if (!name) {
      name = node.isGroup(true) ? node.group.name : node.data.name || node.id
    }
    // get elements
    const nodeElem = document.getElementById(node.id)
    const label = this.state.elem.nameIndicator
    const input = this.state.elem.nameInput
    // set element properties
    input.value = name
    label.innerText = name
    nodeElem.innerText = name
  }

  saveName() {
    const name = this.state.elem.nameInput.value
    const node = this.state.selected.node

    if (node.group.collapsed) {
      // name the group
      // TODO lol check this, it don't look right
      this.state.nodel.manager.createGroup(node.id, name)

    } else {
      // name the node
      node.data.name = name 
    }
  }

  //
  // SORRY, YOU'RE IN YOUR OWN CATEGORY BUD

  updateCollapsedButton(node) {
    let button = this.state.elem.collapseButton
    if (node.group.collapsed) {
      button.innerText = button.getAttribute('on')
    } else {
      button.innerText = button.getAttribute('off')
    }
  }
}
