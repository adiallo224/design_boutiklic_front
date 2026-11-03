module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    // Requis par les modèles WatermelonDB (@field, @date, @children... cf. lib/watermelon/models) —
    // doit être le tout dernier plugin de la liste (contrainte Babel documentée par WatermelonDB).
    plugins: [['@babel/plugin-proposal-decorators', { legacy: true }]],
  };
};
