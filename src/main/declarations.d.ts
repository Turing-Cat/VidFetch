declare module 'fix-path' {
  export default function fixPath(): void;
}

declare module '*.png?asset' {
  const src: string
  export default src
}
