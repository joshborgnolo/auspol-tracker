// ocr-image.swift <image> — print the text macOS Vision recognises in one
// image as a JSON array of {x, y, w, h, text} lines, origin top-left, each
// coordinate a 0..1 fraction of the image. Used by extract-redbridge-afr.mjs
// to read AFR's RedBridge chart graphics, whose figures exist only as pixels.
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

guard CommandLine.arguments.count == 2 else {
  FileHandle.standardError.write("usage: ocr-image <image>\n".data(using: .utf8)!)
  exit(2)
}
let url = URL(fileURLWithPath: CommandLine.arguments[1])
guard let img = NSImage(contentsOf: url),
      let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
  FileHandle.standardError.write("ocr-image: cannot read \(url.path)\n".data(using: .utf8)!)
  exit(1)
}

var lines: [[String: Any]] = []
var lastError: Error?
for _ in 0..<3 {
  let req = VNRecognizeTextRequest()
  req.recognitionLevel = .accurate
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
