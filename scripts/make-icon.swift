// Draws a simple Store icon: an SF Symbol on a rounded, softly graded tile.
// Writes icon.png (light) and icon@dark.png, both 512 × 512.
//
//   swift scripts/make-icon.swift <sf symbol> <hex color> <assets folder>
//
// A stand-in until an extension has artwork of its own.
import AppKit

let arguments = CommandLine.arguments
guard arguments.count == 4, let symbol = NSImage(systemSymbolName: arguments[1], accessibilityDescription: nil),
      let hex = Int(arguments[2].trimmingCharacters(in: CharacterSet(charactersIn: "#")), radix: 16) else {
    FileHandle.standardError.write(Data("Usage: swift scripts/make-icon.swift <sf symbol> <hex color> <assets folder>\n".utf8))
    exit(1)
}
let base = NSColor(srgbRed: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255,
                   blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
let folder = URL(fileURLWithPath: arguments[3], isDirectory: true)
try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)

func draw(dark: Bool) throws -> Data {
    let size = 512
    guard let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8,
                                        samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
                                        bytesPerRow: 0, bitsPerPixel: 0) else { throw CocoaError(.fileWriteUnknown) }
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
    let rect = NSRect(x: 0, y: 0, width: size, height: size)
    let tile = NSBezierPath(roundedRect: rect, xRadius: 115, yRadius: 115)
    // Light: the color, brighter at the top. Dark: a deep tile with the color in the symbol.
    let top = dark ? NSColor(white: 0.20, alpha: 1) : base.blended(withFraction: 0.25, of: .white)!
    let bottom = dark ? NSColor(white: 0.10, alpha: 1) : base.blended(withFraction: 0.15, of: .black)!
    NSGradient(starting: bottom, ending: top)!.draw(in: tile, angle: 90)
    let configuration = NSImage.SymbolConfiguration(pointSize: 250, weight: .semibold)
        .applying(.init(paletteColors: [dark ? base.blended(withFraction: 0.2, of: .white)! : .white]))
    guard let glyph = symbol.withSymbolConfiguration(configuration) else { throw CocoaError(.fileWriteUnknown) }
    let scale = min(300 / glyph.size.width, 300 / glyph.size.height)
    let glyphSize = NSSize(width: glyph.size.width * scale, height: glyph.size.height * scale)
    glyph.draw(in: NSRect(x: (CGFloat(size) - glyphSize.width) / 2, y: (CGFloat(size) - glyphSize.height) / 2,
                          width: glyphSize.width, height: glyphSize.height))
    NSGraphicsContext.restoreGraphicsState()
    guard let png = bitmap.representation(using: .png, properties: [:]) else { throw CocoaError(.fileWriteUnknown) }
    return png
}

try draw(dark: false).write(to: folder.appendingPathComponent("icon.png"))
try draw(dark: true).write(to: folder.appendingPathComponent("icon@dark.png"))
print("Wrote \(folder.path)/icon.png and icon@dark.png")
