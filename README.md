# Quiver Partical Simulator
vector-field plotter with an editable equation for the field, arrow density controls, and animated flow lines or particless. 

## Windows desktop build

The Windows desktop wrapper runs the shared equation compiler and 3D particle engine in an offline-capable Electron app. See [desktop/windows/README.md](desktop/windows/README.md) for development, installer, and portable build commands. A Windows CI workflow checks the engine and packages both `.exe` formats on pushes to the Windows wrapper branch.
