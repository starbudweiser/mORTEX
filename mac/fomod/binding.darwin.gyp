{
    "targets": [
        {
            "target_name": "modinstaller",
            "sources": ["src-native/main.cpp"],
            "include_dirs": [
                "<!@(node -p \"require('node-addon-api').include\")",
                "<(module_root_dir)"
            ],
            "libraries": [
                "<(module_root_dir)/ModInstaller.Native.dylib",
                "-Wl,-rpath,@loader_path/../.."
            ],
            "defines": ["NAPI_CPP_EXCEPTIONS"],
            "xcode_settings": {
                "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
                "CLANG_CXX_LANGUAGE_STANDARD": "c++17",
                "OTHER_CPLUSPLUSFLAGS": ["-fexceptions"]
            }
        }
    ]
}
