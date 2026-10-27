// mORTEX : aperçu Quick Look (barre d'espace dans le Finder) des fichiers de mods.
//  - textures .dds : l'image, ses dimensions, sa compression (BC1…BC7) et ses mipmaps
//  - plugins .esp/.esm/.esl : type, auteur, description, maîtres et contenu par catégorie
// Extension intégrée à mORTEX.app (Contents/PlugIns), aperçu HTML renvoyé à Quick Look.
import Foundation
import ImageIO
import QuickLookUI
import UniformTypeIdentifiers

final class PreviewProvider: QLPreviewProvider, QLPreviewingController {
    func providePreview(for request: QLFilePreviewRequest) async throws -> QLPreviewReply {
        let url = request.fileURL
        let html: String
        if url.pathExtension.lowercased() == "dds" {
            html = try DDSPreview.html(for: url)
        } else {
            html = try PluginPreview.html(for: url)
        }
        return QLPreviewReply(dataOfContentType: .html, contentSize: CGSize(width: 820, height: 640)) { _ in
            Data(html.utf8)
        }
    }
}

func L(_ key: String) -> String {
    NSLocalizedString(key, bundle: Bundle(for: PreviewProvider.self), comment: "")
}

func escape(_ text: String) -> String {
    text.replacingOccurrences(of: "&", with: "&amp;")
        .replacingOccurrences(of: "<", with: "&lt;")
        .replacingOccurrences(of: ">", with: "&gt;")
}

/// Page sombre aux couleurs de Socle, « m » de mORTEX en orange
func page(title: String, badge: String, rows: [(String, String)], body: String) -> String {
    let table = rows.map { "<tr><th>\(escape($0.0))</th><td>\(escape($0.1))</td></tr>" }.joined()
    return """
    <!doctype html><html><head><meta charset="utf-8"><style>
    :root { color-scheme: dark; }
    body { margin: 0; padding: 24px; background: #1e1e1e; color: #ddd;
           font: 13px/1.45 -apple-system, BlinkMacSystemFont, sans-serif; }
    h1 { font-size: 18px; margin: 0 0 4px; color: #fff; word-break: break-all; }
    .badge { display: inline-block; margin-bottom: 16px; padding: 1px 8px; border-radius: 4px;
             background: #3a2a08; color: #f59e0b; font-size: 11px; font-weight: 600; }
    .brand { color: #aaa; font-size: 11px; float: right; }
    .brand b { color: #f59e0b; font-weight: 600; }
    table { border-collapse: collapse; margin-bottom: 16px; }
    th { text-align: left; color: #aaa; font-weight: 400; padding: 2px 16px 2px 0; vertical-align: top; }
    td { color: #fff; padding: 2px 0; }
    img { max-width: 100%; max-height: 480px; display: block; border-radius: 6px;
          background: repeating-conic-gradient(#2c2c2c 0 25%, #222 0 50%) 0 0 / 16px 16px; }
    ul { margin: 4px 0 0; padding-left: 18px; } li { margin: 1px 0; }
    .muted { color: #8f8f8f; }
    </style></head><body>
    <span class="brand"><b>m</b>ORTEX</span>
    <h1>\(escape(title))</h1><span class="badge">\(escape(badge))</span>
    <table>\(table)</table>\(body)</body></html>
    """
}

enum PreviewError: Error { case unreadable }

// MARK: - DDS

enum DDSPreview {
    static func html(for url: URL) throws -> String {
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }
        let header = try handle.read(upToCount: 148) ?? Data()
        guard header.count >= 128, header.prefix(4) == Data("DDS ".utf8) else { throw PreviewError.unreadable }
        func u32(_ offset: Int) -> UInt32 {
            header.subdata(in: offset..<offset + 4).withUnsafeBytes { $0.loadUnaligned(as: UInt32.self) }
        }
        let height = u32(12), width = u32(16), mips = max(1, u32(28))
        let fourCC = String(data: header.subdata(in: 84..<88), encoding: .ascii) ?? ""
        var format = fourCC.trimmingCharacters(in: .controlCharacters)
        if fourCC == "DX10", header.count >= 148 {
            format = dxgiName(u32(128))
        } else {
            format = ["DXT1": "BC1 (DXT1)", "DXT3": "BC2 (DXT3)", "DXT5": "BC3 (DXT5)",
                      "ATI1": "BC4", "BC4U": "BC4", "ATI2": "BC5", "BC5U": "BC5"][format]
                ?? (format.isEmpty ? L("Uncompressed") : format)
        }
        let size = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
        var image = "<p class=\"muted\">\(escape(L("This texture can't be shown by macOS.")))</p>"
        if let source = CGImageSourceCreateWithURL(url as CFURL, nil),
           // 1024 px au plus : l'aperçu reste léger et s'ouvre vite
           let cg = CGImageSourceCreateThumbnailAtIndex(source, 0, [
               kCGImageSourceCreateThumbnailFromImageAlways: true,
               kCGImageSourceThumbnailMaxPixelSize: 1024,
           ] as CFDictionary) {
            let data = NSMutableData()
            if let dest = CGImageDestinationCreateWithData(data, UTType.png.identifier as CFString, 1, nil) {
                CGImageDestinationAddImage(dest, cg, nil)
                if CGImageDestinationFinalize(dest) {
                    image = "<img src=\"data:image/png;base64,\((data as Data).base64EncodedString())\">"
                }
            }
        }
        return page(
            title: url.lastPathComponent, badge: L("DDS texture"),
            rows: [(L("Dimensions"), "\(width) × \(height)"), (L("Compression"), format),
                   (L("Mipmaps"), "\(mips)"),
                   (L("Size"), ByteCountFormatter.string(fromByteCount: Int64(size), countStyle: .file))],
            body: image)
    }

    static func dxgiName(_ code: UInt32) -> String {
        switch code {
        case 70...72: return "BC1"
        case 73...75: return "BC2"
        case 76...78: return "BC3"
        case 79...81: return "BC4"
        case 82...84: return "BC5"
        case 94...96: return "BC6H"
        case 97...99: return "BC7"
        case 27...29: return "RGBA8"
        case 87...93: return "BGRA8"
        default: return "DXGI \(code)"
        }
    }
}

// MARK: - Plugins Bethesda

enum PluginPreview {
    /// catégories courantes des groupes de premier niveau
    static let groupNames: [String: String] = [
        "WEAP": "Weapons", "ARMO": "Armor", "NPC_": "NPCs", "CELL": "Interior cells",
        "WRLD": "Worldspaces", "QUST": "Quests", "SPEL": "Spells", "BOOK": "Books",
        "MISC": "Misc items", "ALCH": "Potions", "INGR": "Ingredients", "LVLI": "Leveled items",
        "LVLN": "Leveled NPCs", "RACE": "Races", "PERK": "Perks", "MGEF": "Magic effects",
        "ENCH": "Enchantments", "KYWD": "Keywords", "GLOB": "Globals", "FLST": "Form lists",
        "STAT": "Statics", "TXST": "Texture sets", "DIAL": "Dialogue", "PACK": "AI packages",
        "SCPT": "Scripts", "COBJ": "Recipes", "OTFT": "Outfits", "FACT": "Factions",
    ]

    static func html(for url: URL) throws -> String {
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }
        guard let head = try handle.read(upToCount: 24), head.count == 24,
              head.prefix(4) == Data("TES4".utf8) else { throw PreviewError.unreadable }
        func u32(_ data: Data, _ offset: Int) -> UInt32 {
            data.subdata(in: offset..<offset + 4).withUnsafeBytes { $0.loadUnaligned(as: UInt32.self) }
        }
        let dataSize = Int(u32(head, 4)), flags = u32(head, 8)
        let fields = try handle.read(upToCount: dataSize) ?? Data()

        var author = "", description = "", masters: [String] = [], records: UInt32 = 0
        var offset = 0
        while offset + 6 <= fields.count {
            let type = String(data: fields.subdata(in: offset..<offset + 4), encoding: .ascii) ?? ""
            let size = Int(fields.subdata(in: offset + 4..<offset + 6).withUnsafeBytes { $0.loadUnaligned(as: UInt16.self) })
            let start = offset + 6, end = min(fields.count, start + size)
            let value = fields.subdata(in: start..<end)
            let text = String(data: value.prefix { $0 != 0 }, encoding: .windowsCP1252) ?? ""
            switch type {
            case "HEDR" where value.count >= 8: records = u32(value, 4)
            case "CNAM": author = text
            case "SNAM": description = text
            case "MAST": masters.append(text)
            default: break
            }
            offset = end
        }

        // groupes de premier niveau : on saute de l'un à l'autre sans lire leur contenu
        var groups: [(String, UInt64)] = []
        var position = UInt64(24 + dataSize)
        let fileSize = (try? handle.seekToEnd()) ?? 0
        while position + 24 <= fileSize && groups.count < 200 {
            try handle.seek(toOffset: position)
            guard let gh = try handle.read(upToCount: 24), gh.count == 24,
                  gh.prefix(4) == Data("GRUP".utf8) else { break }
            let size = UInt64(u32(gh, 4))
            let label = String(data: gh.subdata(in: 8..<12), encoding: .ascii) ?? "?"
            groups.append((label, size))
            guard size >= 24 else { break }
            position += size
        }

        let ext = url.pathExtension.lowercased()
        let kind = (flags & 0x200) != 0 || ext == "esl" ? L("Light plugin (ESL)")
            : (flags & 0x1) != 0 || ext == "esm" ? L("Master plugin (ESM)") : L("Plugin (ESP)")
        var rows: [(String, String)] = [(L("Records"), "\(records)")]
        if !author.isEmpty { rows.append((L("Author"), author)) }
        if !description.isEmpty { rows.append((L("Description"), description)) }
        if (flags & 0x80) != 0 { rows.append((L("Strings"), L("Localized (STRINGS files)"))) }

        var body = "<p><b>\(escape(L("Masters")))</b></p>"
        body += masters.isEmpty ? "<p class=\"muted\">\(escape(L("None")))</p>"
            : "<ul>" + masters.map { "<li>\(escape($0))</li>" }.joined() + "</ul>"
        if !groups.isEmpty {
            body += "<p><b>\(escape(L("Contents")))</b></p><ul>"
            for (label, size) in groups.sorted(by: { $0.1 > $1.1 }).prefix(20) {
                let name = groupNames[label].map { L($0) } ?? label
                body += "<li>\(escape(name)) <span class=\"muted\">\(label) · \(ByteCountFormatter.string(fromByteCount: Int64(size), countStyle: .file))</span></li>"
            }
            body += "</ul>"
        }
        return page(title: url.lastPathComponent, badge: kind, rows: rows, body: body)
    }
}
