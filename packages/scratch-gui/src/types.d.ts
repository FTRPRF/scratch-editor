declare module '!arraybuffer-loader!.*' {
  declare const value: ArrayBuffer;
  export default value;
}

declare module '!raw-loader!.*' {
  declare const value: string;
  export default value;
}

declare module 'scratch-paint';

// Window interface extensions for scratch-judge
declare global {
  interface Window {
    VirtualMachine: typeof import('scratch-vm').default;
    ScratchStorage: typeof import('scratch-storage').default;
    ScratchSVGRenderer: typeof import('scratch-svg-renderer').default;
    AudioEngine: typeof import('scratch-audio').default;
    ScratchRender: typeof import('scratch-render').default;
    getFonts: typeof import('scratch-render-fonts').default;
  }
}
