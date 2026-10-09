// ocr-image.swift <image> [scale] [fast] — print the text macOS Vision
// recognises in one image as a JSON array of {x, y, w, h, text} lines, origin
// top-left, each coordinate a 0..1 fraction of the image. Used by
// extract-redbridge-afr.mjs to read AFR's RedBridge chart graphics, and by
// extract-roymorgan-demo.mjs to read Roy Morgan's "Primary Vote by …" table
// images, whose figures exist only as pixels.
//
// Optional second argument scales the image before recognising (the small
// Roy Morgan table PNGs lose figure cells to the recogniser at native size;
// 3 restores them). Optional third argument "fast" selects recognitionLevel
// .fast — the fallback when this machine's .accurate Neural Engine path is
// wedged (the e5rt error below, persistent rather than cold-start).
//
// Compiled on demand by the extractor (swiftc ships with the Xcode command
// line tools; Vision is a system framework, so no dependencies). Language
// correction is off: it "fixes" figures like "-6 (-3)" into words.
//
// Vision's Neural Engine path occasionally throws an e5rt error on a cold
// start (seen 2 in 40 images, 2026-10-04); the request is retried before
// giving up, and the exit code is 1 so the caller can retry the image.
import AppKit
import Foundation
import Vision

guard CommandLine.arguments.count >= 2 else {
  FileHandle.standardError.write("usage: ocr-image <image> [scale] [fast]\n".data(using: .utf8)!)
  exit(2)
}
let scale = CommandLine.arguments.count >= 3 ? (Double(CommandLine.arguments[2]) ?? 1) : 1
let fast = CommandLine.arguments.count >= 4 && CommandLine.arguments[3] == "fast"
let url = URL(fileURLWithPath: CommandLine.arguments[1])
guard let img = NSImage(contentsOf: url),
      let base = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
  FileHandle.standardError.write("ocr-image: cannot read \(url.path)\n".data(using: .utf8)!)
  exit(1)
}
var cg = base
if scale > 1 {
  let w = Int(Double(base.width) * scale), h = Int(Double(base.height) * scale)
  guard let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8,
                            bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(),
                            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
    FileHandle.standardError.write("ocr-image: cannot allocate scaled bitmap\n".data(using: .utf8)!)
    exit(1)
  }
  ctx.interpolationQuality = .high
  ctx.draw(base, in: CGRect(x: 0, y: 0, width: w, height: h))
  guard let scaled = ctx.makeImage() else {
    FileHandle.standardError.write("ocr-image: scaling failed\n".data(using: .utf8)!)
    exit(1)
  }
  cg = scaled
}

var lines: [[String: Any]] = []
var lastError: Error?
for _ in 0..<3 {
  let req = VNRecognizeTextRequest()
  req.recognitionLevel = fast ? .fast : .accurate
  req.usesLanguageCorrection = false
  do {
    try VNImageRequestHandler(cgImage: cg).perform([req])
    for o in req.results ?? [] {
      guard let t = o.topCandidates(1).first?.string else { continue }
      let b = o.boundingBox
      let r = { (v: CGFloat) in (Double(v) * 1000).rounded() / 1000 }
      lines.append(["x": r(b.minX), "y": r(1 - b.maxY), "w": r(b.width), "h": r(b.height), "text": t])
    }
    lastError = nil
    break
  } catch {
    lastError = error
    Thread.sleep(forTimeInterval: 1)
  }
}
if let e = lastError {
  FileHandle.standardError.write("ocr-image: \(e)\n".data(using: .utf8)!)
  exit(1)
}
let data = try JSONSerialization.data(withJSONObject: lines, options: [])
FileHandle.standardOutput.write(data)
FileHandle.standardOutput.write("\n".data(using: .utf8)!)
