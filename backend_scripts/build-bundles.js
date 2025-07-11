// scripts/build-pi.js
import { build } from 'esbuild';
import path from 'path';

const resolveAsset = (assetPath) => {
  // strip leading slash and resolve under ./assets/js/
  const rel = assetPath.replace(/^\/assets\/js\//, '');
  return path.resolve(process.cwd(), 'assets/js', rel);
};

build({
  entryPoints: ['assets/js/pi-generator.js','assets/js/script.js'],
  bundle: true,
  platform: 'browser',  
  format: 'esm',
  outdir: 'assets/bundles/',
  loader: { 
    '.json': 'json', 
  },
  plugins: [{
    name: 'assets-alias',
    setup(build) {
      build.onResolve({ filter: /^\/assets\/js\// }, args => ({
        path: resolveAsset(args.path),
        namespace: 'file',
      }));
    }
  }],
}).catch(() => process.exit(1));
