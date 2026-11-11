// Draws a Store icon in the macOS 26 format: an SF Symbol in white glass on a colored squircle,
// with the shadow and edge light of Apple's own app icons. Writes icon.png (light) and
// icon@dark.png, both 512 × 512, matching the NotchNotch Extension Icon Template in Figma.
//
//   swift scripts/make-icon.swift <sf symbol> <color> <assets folder>
//
// <color> is one of Blue, Green, Yellow, Red, Pink, Purple, Graphite, or a hex color like #FF6363.
// A stand-in until an extension has artwork of its own.
import AppKit
import CoreImage

// MARK: - Inputs

struct Tint { let top: CGColor; let bottom: CGColor; let darkGlyph: CGColor }

func color(_ hex: Int, _ alpha: CGFloat = 1) -> CGColor {
    CGColor(srgbRed: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255, alpha: alpha)
}

func mix(_ hex: Int, with target: CGFloat, _ amount: CGFloat) -> CGColor {
    let c = color(hex).components!
    return CGColor(srgbRed: c[0] + (target - c[0]) * amount, green: c[1] + (target - c[1]) * amount,
                   blue: c[2] + (target - c[2]) * amount, alpha: 1)
}

// The seven tile colors of the template: (top, bottom, glyph on the dark tile).
let palette: [String: (Int, Int, Int)] = [
    "blue": (0x00D3FE, 0x0363BC, 0x3FDCFF), "green": (0x83FDAF, 0x21898A, 0x83FDAF),
    "yellow": (0xFDDD38, 0xB67700, 0xFDDD38), "red": (0xFF6363, 0xD72A2A, 0xFF7A7A),
    "pink": (0xF672E1, 0xBE3FEC, 0xF672E1), "purple": (0xAE55F4, 0x6A18BC, 0xBE7BF7),
    "graphite": (0x686C73, 0x1A1F23, 0xC9CDD2),
]

func tint(named name: String) -> Tint? {
    if let (top, bottom, glyph) = palette[name.lowercased()] {
        return Tint(top: color(top), bottom: color(bottom), darkGlyph: color(glyph))
    }
    guard let hex = Int(name.trimmingCharacters(in: CharacterSet(charactersIn: "#")), radix: 16) else { return nil }
    return Tint(top: mix(hex, with: 1, 0.2), bottom: mix(hex, with: 0, 0.25), darkGlyph: mix(hex, with: 1, 0.2))
}

let arguments = CommandLine.arguments
guard arguments.count == 4, let symbol = NSImage(systemSymbolName: arguments[1], accessibilityDescription: nil),
      let tint = tint(named: arguments[2]) else {
    FileHandle.standardError.write(Data("""
        Usage: swift scripts/make-icon.swift <sf symbol> <color> <assets folder>
        <color>: Blue, Green, Yellow, Red, Pink, Purple, Graphite, or a hex color like #FF6363\n
        """.utf8))
    exit(1)
}
let folder = URL(fileURLWithPath: arguments[3], isDirectory: true)
try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)

// MARK: - Geometry

let size = 512
let canvas = CGRect(x: 0, y: 0, width: size, height: size)
// The body sits 50 px in from every edge, like the 824 body in Apple's 1024 icon grid.
let bodyRect = canvas.insetBy(dx: 50, dy: 50)
let glyphBox = canvas.insetBy(dx: 120, dy: 120)

// Lower half of the top-left corner, as fractions of the body (top-down), traced from the
// alpha edge of macOS 26 system icons. It runs from the diagonal down to where the edge turns straight.
let corner: [CGPoint] = [
    (0.07564, 0.07585), (0.07244, 0.07949), (0.06900, 0.08313), (0.06564, 0.08677), (0.06225, 0.09041),
    (0.05935, 0.09405), (0.05671, 0.09769), (0.05372, 0.10133), (0.05101, 0.10498), (0.04836, 0.10862),
    (0.04598, 0.11226), (0.04369, 0.11590), (0.04130, 0.11954), (0.03892, 0.12318), (0.03672, 0.12682),
    (0.03499, 0.13046), (0.03290, 0.13410), (0.03121, 0.13774), (0.02916, 0.14138), (0.02745, 0.14502),
    (0.02575, 0.14867), (0.02429, 0.15231), (0.02290, 0.15595), (0.02141, 0.15959), (0.01972, 0.16323),
    (0.01854, 0.16687), (0.01758, 0.17051), (0.01658, 0.17415), (0.01551, 0.17779), (0.01447, 0.18143),
    (0.01348, 0.18507), (0.01268, 0.18871), (0.01187, 0.19235), (0.01095, 0.19600), (0.01031, 0.19964),
    (0.00958, 0.20328), (0.00869, 0.20692), (0.00828, 0.21056), (0.00749, 0.21420), (0.00708, 0.21784),
    (0.00631, 0.22148), (0.00596, 0.22512), (0.00555, 0.22876), (0.00493, 0.23240), (0.00465, 0.23604),
    (0.00421, 0.23968), (0.00375, 0.24333), (0.00353, 0.24697), (0.00327, 0.25061), (0.00278, 0.25425),
    (0.00252, 0.25789), (0.00236, 0.26153), (0.00221, 0.26517), (0.00197, 0.26881), (0.00167, 0.27245),
    (0.00143, 0.27609), (0.00128, 0.27973), (0.00117, 0.28337), (0.00108, 0.28701), (0.00101, 0.29066),
    (0.00093, 0.29430), (0.00083, 0.29794), (0.00069, 0.30158), (0.00050, 0.30522), (0.00038, 0.30886),
    (0.00029, 0.31250), (0.00000, 0.31311),
].map { CGPoint(x: $0.0, y: $0.1) }

let bodyPath: CGPath = {
    // Whole top-left corner, left edge to top edge, then the same corner turned to each side.
    let topLeft = corner.reversed() + corner.dropFirst().map { CGPoint(x: $0.y, y: $0.x) }
    let turns: [(CGPoint) -> CGPoint] = [
        { $0 }, { CGPoint(x: 1 - $0.y, y: $0.x) }, { CGPoint(x: 1 - $0.x, y: 1 - $0.y) }, { CGPoint(x: $0.y, y: 1 - $0.x) },
    ]
    let path = CGMutablePath()
    for turn in turns {
        for point in topLeft.map(turn) {
            // Body fractions (top-down) to canvas pixels (Core Graphics is bottom-up).
            let pixel = CGPoint(x: bodyRect.minX + point.x * bodyRect.width, y: bodyRect.maxY - point.y * bodyRect.height)
            path.isEmpty ? path.move(to: pixel) : path.addLine(to: pixel)
        }
    }
    path.closeSubpath()
    return path
}()

// MARK: - Drawing helpers

let sRGB = CGColorSpace(name: CGColorSpace.sRGB)!
let ci = CIContext(options: [.workingColorSpace: sRGB, .outputColorSpace: sRGB])

func layer(_ draw: (CGContext) -> Void) -> CGImage {
    let context = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0, space: sRGB,
                            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    draw(context)
    return context.makeImage()!
}

func render(_ image: CIImage) -> CGImage { ci.createCGImage(image.cropped(to: canvas), from: canvas)! }

func blurred(_ image: CIImage, sigma: Double) -> CIImage {
    image.clampedToExtent().applyingGaussianBlur(sigma: sigma).cropped(to: canvas)
}

/// Keeps the alpha of `image` and paints it one color.
func painted(_ image: CIImage, _ color: CGColor, alpha: CGFloat = 1) -> CIImage {
    let c = color.converted(to: sRGB, intent: .defaultIntent, options: nil)!.components!
    return image.applyingFilter("CIColorMatrix", parameters: [
        "inputRVector": CIVector(x: 0, y: 0, z: 0, w: 0), "inputGVector": CIVector(x: 0, y: 0, z: 0, w: 0),
        "inputBVector": CIVector(x: 0, y: 0, z: 0, w: 0), "inputAVector": CIVector(x: 0, y: 0, z: 0, w: alpha),
        "inputBiasVector": CIVector(x: c[0], y: c[1], z: c[2], w: 0),
    ])
}

/// A vertical gradient over `rect`, from `top` to `bottom`, cut to the alpha of `mask`.
func gradient(_ top: CGColor, _ bottom: CGColor, over rect: CGRect, in mask: CIImage) -> CIImage {
    CIFilter(name: "CILinearGradient", parameters: [
        "inputPoint0": CIVector(x: rect.midX, y: rect.maxY), "inputColor0": CIColor(cgColor: top),
        "inputPoint1": CIVector(x: rect.midX, y: rect.minY), "inputColor1": CIColor(cgColor: bottom),
    ])!.outputImage!.applyingFilter("CISourceInCompositing", parameters: [kCIInputBackgroundImageKey: mask])
}

func over(_ layers: [CIImage]) -> CIImage {
    layers.reduce(CIImage.empty().cropped(to: canvas)) { $1.composited(over: $0) }
}

// MARK: - Icon

func draw(dark: Bool) -> CGImage {
    let white = CGColor(srgbRed: 1, green: 1, blue: 1, alpha: 1)

    // Body: vertical gradient, with the system drop shadow (21% black, 5 px down, blur 18).
    let body = layer { context in
        context.saveGState()
        context.setShadow(offset: CGSize(width: 0, height: -5), blur: 18, color: CGColor(gray: 0, alpha: 0.21))
        context.addPath(bodyPath)
        context.setFillColor(dark ? color(0x141518) : tint.bottom)
        context.fillPath()
        context.restoreGState()
        context.addPath(bodyPath)
        context.clip()
        let colors = dark ? [color(0x3A3B3F), color(0x141518)] : [tint.top, tint.bottom]
        context.drawLinearGradient(CGGradient(colorsSpace: sRGB, colors: colors as CFArray, locations: [0, 1])!,
                                   start: CGPoint(x: 0, y: bodyRect.maxY), end: CGPoint(x: 0, y: bodyRect.minY), options: [])
    }

    // Edge light: a 9 px stroke along the body edge, blurred and kept inside the body.
    // 53% white at the top and sides, half of that at the bottom.
    let strength: CGFloat = dark ? 0.6 : 1
    let stroke = layer { context in
        context.addPath(bodyPath)
        context.setLineWidth(9)
        context.replacePathWithStrokedPath()
        context.clip()
        let colors = [0.53, 0.53, 0.265].map { CGColor(srgbRed: 1, green: 1, blue: 1, alpha: $0 * strength) }
        // The stroke reaches 4.5 px past the body, so let the gradient run on past both ends.
        context.drawLinearGradient(CGGradient(colorsSpace: sRGB, colors: colors as CFArray, locations: [0, 0.45, 1])!,
                                   start: CGPoint(x: 0, y: bodyRect.maxY), end: CGPoint(x: 0, y: bodyRect.minY),
                                   options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])
    }
    let bodyMask = CIImage(cgImage: layer { $0.addPath(bodyPath); $0.setFillColor(white); $0.fillPath() })
    let rim = blurred(CIImage(cgImage: stroke), sigma: 3)
        .applyingFilter("CISourceInCompositing", parameters: [kCIInputBackgroundImageKey: bodyMask])

    // Glyph: the symbol fitted into the 272 px box, as a plain alpha mask.
    var glyphRect = glyphBox
    let glyphMask = CIImage(cgImage: layer { context in
        let configuration = NSImage.SymbolConfiguration(pointSize: 400, weight: .semibold)
            .applying(.init(paletteColors: [.white]))
        let image = symbol.withSymbolConfiguration(configuration)!
        let scale = min(glyphBox.width / image.size.width, glyphBox.height / image.size.height)
        let fitted = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        glyphRect = CGRect(x: glyphBox.midX - fitted.width / 2, y: glyphBox.midY - fitted.height / 2,
                           width: fitted.width, height: fitted.height)
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: false)
        image.draw(in: glyphRect)
        NSGraphicsContext.restoreGraphicsState()
    })

    // White glass, 88% at the top to 60% at the bottom. On the dark tile, the tile's color instead.
    let glass = dark ? [tint.darkGlyph, tint.darkGlyph.copy(alpha: 0.85)!] : [white.copy(alpha: 0.88)!, white.copy(alpha: 0.6)!]
    let fill = gradient(glass[0], glass[1], over: glyphRect, in: glyphMask)
    // Contact shadow: 28% black, 3 px down, blur 7. Only outside the glyph, so it never shows through the glass.
    let shadow = blurred(painted(glyphMask, CGColor(gray: 0, alpha: 1), alpha: 0.28), sigma: 3.5)
        .transformed(by: CGAffineTransform(translationX: 0, y: -3))
        .applyingFilter("CISourceOutCompositing", parameters: [kCIInputBackgroundImageKey: glyphMask])
    // Inner light: 65% white falling in from the top edge, 1 px down, blur 4.
    let outside = painted(CIImage(color: CIColor.white).cropped(to: canvas), white)
        .applyingFilter("CISourceOutCompositing", parameters: [kCIInputBackgroundImageKey: glyphMask])
    let innerLight = painted(blurred(outside.transformed(by: CGAffineTransform(translationX: 0, y: -1)), sigma: 2), white, alpha: 0.65)
        .applyingFilter("CISourceInCompositing", parameters: [kCIInputBackgroundImageKey: glyphMask])
    // Glass edge: a 3 px band just inside the outline, white at the top to 55% at the bottom.
    let inner = glyphMask.applyingFilter("CIMorphologyMinimum", parameters: [kCIInputRadiusKey: 3])
    let band = glyphMask.applyingFilter("CISourceOutCompositing", parameters: [kCIInputBackgroundImageKey: inner])
    let edge = gradient(white, white.copy(alpha: 0.55)!, over: glyphRect, in: band)

    return render(over([CIImage(cgImage: body), rim, shadow, fill, innerLight, edge]))
}

for (dark, name) in [(false, "icon.png"), (true, "icon@dark.png")] {
    let png = NSBitmapImageRep(cgImage: draw(dark: dark)).representation(using: .png, properties: [:])!
    try png.write(to: folder.appendingPathComponent(name))
}
print("Wrote \(folder.path)/icon.png and icon@dark.png")
