import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate, WidgetType } from '@codemirror/view'
import { type Extension, RangeSetBuilder } from '@codemirror/state'
import { indentUnit } from '@codemirror/language'

class IndentGuideLine extends WidgetType {
  constructor(readonly depth: number, readonly unitWidth: number) { super() }
  toDOM() {
    const wrap = document.createElement('span')
    wrap.className = 'cm-indent-guides'
    wrap.setAttribute('aria-hidden', 'true')
    for (let i = 0; i < this.depth; i++) {
      const guide = document.createElement('span')
      guide.className = 'cm-indent-guide'
      guide.style.display = 'inline-block'
      guide.style.width = `${this.unitWidth}ch`
      guide.style.height = '100%'
      guide.style.borderLeft = '1px solid var(--cm-indent-guide-color, rgba(255,255,255,0.08))'
      guide.style.verticalAlign = 'top'
      wrap.appendChild(guide)
    }
    return wrap
  }
  eq(other: IndentGuideLine) { return this.depth === other.depth && this.unitWidth === other.unitWidth }
  ignoreEvent() { return true }
}

function indentGuides(): Extension {
  return [
    EditorView.baseTheme({
      '.cm-indent-guides': {
        position: 'absolute',
        left: '0',
        top: '0',
        bottom: '0',
        display: 'inline-flex',
        pointerEvents: 'none',
        zIndex: '0',
      },
      '&.cm-light .cm-indent-guide': {
        borderLeftColor: 'var(--cm-indent-guide-color-light, rgba(0,0,0,0.08)) !important',
      },
    }),
    ViewPlugin.fromClass(class {
      decorations: DecorationSet = Decoration.none

      constructor(view: EditorView) {
        this.decorations = this.build(view)
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged || update.heightChanged) {
          this.decorations = this.build(update.view)
        }
      }

      build(view: EditorView): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>()
        const doc = view.state.doc
        const unit = view.state.facet(indentUnit)
        const unitLen = unit.length || 2
        const { from, to } = view.viewport

        let pos = from
        const decorations: { from: number; to: number; deco: Decoration }[] = []

        for (let i = doc.lineAt(from).number; i <= doc.lineAt(to).number; i++) {
          const line = doc.line(i)
          const text = line.text
          let indent = 0
          for (let j = 0; j < text.length; j++) {
            if (text[j] === '\t') indent += unitLen - (indent % unitLen)
            else if (text[j] === ' ') indent++
            else break
          }

          const depth = Math.floor(indent / unitLen)
          if (depth > 0) {
            const deco = Decoration.widget({
              widget: new IndentGuideLine(depth, unitLen),
              side: -1,
            })
            decorations.push({ from: line.from, to: line.from, deco })
          }
        }

        decorations.sort((a, b) => a.from - b.from)
        for (const d of decorations) {
          builder.add(d.from, d.to, d.deco)
        }

        return builder.finish()
      }
    }, {
      decorations: v => v.decorations,
    }),
  ]
}

export { indentGuides }
