// A .woff2?url import is the URL the build serves the file at (the turbopack
// rule in next.config.ts).
declare module "*.woff2?url" {
  const url: string;
  export default url;
}
