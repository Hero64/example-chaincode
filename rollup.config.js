const resolve =  require('@rollup/plugin-node-resolve'); // Para resolver módulos de node_modules
const commonjs =  require('@rollup/plugin-commonjs');   // Para convertir CommonJS a ESModules
const traser =  require('@rollup/plugin-terser');   // Para minificar el código
const json = require("@rollup/plugin-json");

module.exports = {
  input: 'index.js', // Archivo de entrada
  output: {
    file: 'dist/bundle.js', // Archivo de salida
    format: 'cjs',
    sourcemap: true, // Generar un mapa de fuentes
  },
  plugins: [
    json(),
    resolve({
      preferBuiltins: true,
    }), // Resuelve las dependencias de node_modules
    commonjs(), // Convierte CommonJS a ESM
    // traser(), // Minifica el código para producción
  ],
   external: ['fs', 'path']
};