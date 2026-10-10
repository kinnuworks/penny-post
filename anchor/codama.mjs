export default {
  idl: 'target/idl/dak.json',
  scripts: {
    js: {
      from: '@codama/renderers-js',
      args: [
        'anchor/src/client/js',
        { generatedFolder: 'generated', kitImportStrategy: 'rootOnly', syncPackageJson: false },
      ],
    },
  },
}
