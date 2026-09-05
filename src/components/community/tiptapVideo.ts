import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    video: {
      /** 업로드한 동영상을 본문에 블록으로 삽입한다. */
      setVideo: (options: { src: string; title?: string }) => ReturnType;
    };
  }
}

/**
 * Tiptap 기본 스키마에는 동영상 노드가 없어서 <video> 태그를 그대로 넣으면
 * 파서가 제거해 버린다. 업로드한 동영상이 본문 블록으로 남도록 노드를 정의한다.
 */
export const Video = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: null },
      title: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'video[src]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'video',
      mergeAttributes(HTMLAttributes, {
        controls: 'true',
        preload: 'metadata',
        playsinline: 'true',
        class: 'rounded-lg max-w-full my-4 border border-slate-200 bg-black h-auto block',
      }),
    ];
  },

  addCommands() {
    return {
      setVideo:
        options =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: options }),
    };
  },
});
