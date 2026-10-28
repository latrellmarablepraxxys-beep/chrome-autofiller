# Editor bridge (opt-in)

The extension can fill CKEditor and TipTap without any app changes by dispatching a real `paste` event. That works in most cases but is the least reliable path: ProseMirror and CKEditor's view layer may normalise or ignore synthetic input.

Registering the editor instance on `window.__PRX_QA__` makes the bridge the primary path, with paste/`execCommand` as fallback.

The registry is written on the page's `window`, and the executor runs in the page's main world, so no extra messaging is needed.

## Contract

```ts
window.__PRX_QA__ ??= { editors: new Map() };

window.__PRX_QA__.editors.set(props.id, {
    id: props.id,
    kind: 'ckeditor',          // or 'tiptap'
    el: editorElement,         // the contenteditable root
    get: () => editor.getData(),
    set: (html: string) => editor.setData(html),
});
```

Delete on unmount: `window.__PRX_QA__?.editors.delete(props.id)`.

## `praxxys-backend` — `resources/ts/Components/Shared/Fields/BaseCkEditor.vue`

Inside `initializeEditor`, after the upload adapter is attached and before `change:data`:

```ts
const qa = (window as any).__PRX_QA__ ?? ((window as any).__PRX_QA__ = { editors: new Map() });
qa.editors.set(props.id, {
    id: props.id,
    kind: 'ckeditor',
    el: editor.editing.view.getDomRoot(),
    get: () => editor.getData(),
    set: (html: string) => editor.setData(html),
});
```

Import `onBeforeUnmount` and add:

```ts
onBeforeUnmount(() => (window as any).__PRX_QA__?.editors.delete(props.id));
```

## `praxxys-backend` — `resources/ts/Components/Shared/Fields/BaseTiptapEditor.vue`

After `const editor = useEditor({...})`:

```ts
watch(
    editor,
    (instance) => {
        if (!instance) return;
        const qa = (window as any).__PRX_QA__ ?? ((window as any).__PRX_QA__ = { editors: new Map() });
        qa.editors.set(props.id, {
            id: props.id,
            kind: 'tiptap',
            el: instance.view.dom as HTMLElement,
            get: () => instance.getHTML(),
            set: (html: string) => instance.commands.setContent(html),
        });
    },
    { immediate: true },
);
```

The existing `onBeforeUnmount` should also delete the entry.

## `praxxys-vue-kit` — `src/components/widget/rich-text-editor/RichTextEditor.vue`

Same as `BaseCkEditor`, using `editor.editing.view.getDomRoot()`.

## `praxxys-vue-kit` — `src/components/widget/tiptap-editor/TipTapEditor.vue`

Same as `BaseTiptapEditor`, using `editor.value?.view.dom` and `editor.value?.commands.setContent(html)`.

## Optional targeting attribute

Adding `data-prx-field` to shared inputs makes matching deterministic (the admin currently renders `test-id` as a plain attribute, not `data-testid`):

```vue
<ui-input :data-prx-field="testId ?? id ?? slugify(label)" ... />
```

Keep the attribute stable across renames — use the field name/id, not the label.
