export default {
  idl: 'target/idl/penny_post.json',
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
