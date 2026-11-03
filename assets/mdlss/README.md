# mDLSS bridge

`d3d11.dll` is the bridge built by [mDLSS](https://github.com/starbudweiser/mDLSS)
(`src/ngx_bridge`, `src/enb_bridge`), version of 13 October 2026.

Installed next to `SkyrimSE.exe` by the DXMT workshop. Under CrossOver with DXMT, Streamline
passes its textures to DXMT's `nvngx.dll` as `void*`, which it only accepts as
`ID3D11Resource*` (error `0xBAD00005`, black screen); the bridge re-registers them so DLSS
runs through MetalFX. It also imitates the ENB SDK for ENB presets without ENBSeries.
