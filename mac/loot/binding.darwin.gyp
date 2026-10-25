{
    "targets": [
        {
            "target_name": "node-loot",
            "sources": [
                "src/lootwrapper.cpp",
                "src/exceptions.cpp",
                "src/napi_helpers.cpp",
                "src/util.cpp"
            ],
            "include_dirs": [
                "./loot_api/include",
                "<!(node -p \"require('node-addon-api').include_dir\")"
            ],
            "defines": ["NAPI_CPP_EXCEPTIONS", "NAPI_VERSION=9"],
            "libraries": [
                "<(module_root_dir)/loot_api/libloot.0.dylib",
                "-Wl,-rpath,@loader_path"
            ],
            "xcode_settings": {
                "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
                "CLANG_CXX_LANGUAGE_STANDARD": "c++20",
                "MACOSX_DEPLOYMENT_TARGET": "13.0",
                "OTHER_CPLUSPLUSFLAGS": ["-fexceptions"]
            }
        }
    ]
}
