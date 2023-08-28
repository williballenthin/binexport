# Build JS/TS bindings

```console
❯ node_modules/protobufjs-cli/bin/pbjs -t static-module -w commonjs -o src/BinExport2.js ../../binexport2.proto 
❯ node_modules/protobufjs-cli/bin/pbts -o src/BinExport2.d.ts src/BinExport2.js
```
