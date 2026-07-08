import SwiftUI
import UIKit

/// Identifiable wrapper so a freshly picked image can drive a fullScreenCover.
struct AdjustableImage: Identifiable {
    let id = UUID()
    let image: UIImage
}

/// Frame shape shown in the adjust step.
enum AdjustShape {
    case cover, circle
}

/// Full-screen adjust step shown after picking a cover or avatar image: the
/// clear window matches the final frame (cover card ratio, or a circle for
/// avatars), the rest is dimmed. The user pans/zooms the image, then
/// validation crops it to exactly what the window shows.
/// Mirrors expo/components/CoverAdjustModal.tsx.
struct ImageAdjustView: View {
    let image: UIImage
    var title: String = "Ajuster la couverture"
    var shape: AdjustShape = .cover
    var onCancel: () -> Void
    var onDone: (UIImage) -> Void

    private static let minZoom: CGFloat = 1
    private static let maxZoom: CGFloat = 4
    private static let zoomStep: CGFloat = 0.35

    @State private var zoom: CGFloat = 1
    @State private var baseZoom: CGFloat = 1
    @State private var offset: CGSize = .zero
    @State private var baseOffset: CGSize = .zero

    private let dim = Color(hex: 0x080809, alpha: 0.82)

    /// Clear window matching the SpaceCard ratio (full-width card, 190pt tall),
    /// or a centered square for the circular avatar frame.
    private var frameSize: CGSize {
        let screenW = UIScreen.main.bounds.width
        let coverW = (screenW - Spacing.lg * 2 - 8).rounded()
        if shape == .circle {
            let side = min(coverW, 300)
            return CGSize(width: side, height: side)
        }
        let cardRatio = (screenW - Spacing.lg * 2) / 190
        return CGSize(width: coverW, height: (coverW / cardRatio).rounded())
    }

    /// Displayed size of the image at zoom 1 (covers the clear window exactly).
    private var displaySize: CGSize {
        let imgW = max(image.size.width, 1)
        let imgH = max(image.size.height, 1)
        let coverScale = max(frameSize.width / imgW, frameSize.height / imgH)
        return CGSize(width: imgW * coverScale, height: imgH * coverScale)
    }

    var body: some View {
        ZStack {
            Palette.bgDeep.ignoresSafeArea()
            VStack(spacing: 0) {
                header
                    .padding(.horizontal, Spacing.lg)
                    .padding(.top, Spacing.sm)

                adjustArea
                    .frame(maxWidth: .infinity, maxHeight: .infinity)

                controls
                    .padding(.horizontal, Spacing.lg)
                    .padding(.bottom, Spacing.sm)
            }
        }
        .preferredColorScheme(.dark)
    }

    // MARK: - Header

    private var header: some View {
        HStack(alignment: .top, spacing: Spacing.md) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).gType(.h3)
                Text(shape == .circle
                     ? "Déplace et zoome — le cercle clair sera ta photo"
                     : "Déplace et zoome — la zone claire sera ta couverture")
                    .gType(.caption)
            }
            Spacer()
            IconButton(systemIcon: "xmark", size: 40) { onCancel() }
        }
    }

    // MARK: - Adjust area

    private var adjustArea: some View {
        let frame = frameSize
        let disp = displaySize
        return ZStack {
            Image(uiImage: image)
                .resizable()
                .frame(width: disp.width, height: disp.height)
                .scaleEffect(zoom)
                .offset(offset)

            dimOverlay(frame: frame)
                .allowsHitTesting(false)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .clipped()
        .contentShape(Rectangle())
        .gesture(dragGesture.simultaneously(with: magnifyGesture))
    }

    private func dimOverlay(frame: CGSize) -> some View {
        ZStack {
            dim
                .mask {
                    Rectangle()
                        .overlay {
                            windowShape
                                .frame(width: frame.width, height: frame.height)
                                .blendMode(.destinationOut)
                        }
                        .compositingGroup()
                }

            // Frame border + guide lines.
            windowShape
                .stroke(.white.opacity(0.9), lineWidth: 2)
                .frame(width: frame.width, height: frame.height)

            guides(frame: frame)
                .frame(width: frame.width, height: frame.height)
                .clipShape(windowShape)
        }
    }

    private var windowShape: AnyShape {
        shape == .circle
            ? AnyShape(Circle())
            : AnyShape(RoundedRectangle(cornerRadius: Radius.xl, style: .continuous))
    }

    @ViewBuilder
    private func guides(frame: CGSize) -> some View {
        let line = Color.white.opacity(0.22)
        if shape == .circle {
            ZStack {
                line.frame(width: 1, height: frame.height)
                line.frame(width: frame.width, height: 1)
            }
        } else {
            ZStack {
                HStack(spacing: 0) {
                    Spacer(); line.frame(width: 1); Spacer(); line.frame(width: 1); Spacer()
                }
                VStack(spacing: 0) {
                    Spacer(); line.frame(height: 1); Spacer(); line.frame(height: 1); Spacer()
                }
            }
        }
    }

    // MARK: - Gestures

    private var dragGesture: some Gesture {
        DragGesture()
            .onChanged { value in
                offset = clampedOffset(CGSize(
                    width: baseOffset.width + value.translation.width,
                    height: baseOffset.height + value.translation.height
                ))
            }
            .onEnded { _ in baseOffset = offset }
    }

    private var magnifyGesture: some Gesture {
        MagnifyGesture()
            .onChanged { value in
                zoom = min(Self.maxZoom, max(Self.minZoom, baseZoom * value.magnification))
                offset = clampedOffset(offset)
            }
            .onEnded { _ in
                baseZoom = zoom
                baseOffset = offset
            }
    }

    /// Keeps the image covering the clear window entirely.
    private func clampedOffset(_ next: CGSize) -> CGSize {
        let disp = displaySize
        let frame = frameSize
        let maxTx = max(0, (disp.width * zoom - frame.width) / 2)
        let maxTy = max(0, (disp.height * zoom - frame.height) / 2)
        return CGSize(
            width: min(maxTx, max(-maxTx, next.width)),
            height: min(maxTy, max(-maxTy, next.height))
        )
    }

    // MARK: - Controls

    private var controls: some View {
        VStack(spacing: Spacing.lg) {
            HStack(spacing: Spacing.lg) {
                IconButton(systemIcon: "minus", size: 44) { stepZoom(-Self.zoomStep) }
                Text("\(Int((zoom * 100).rounded())) %")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Palette.text)
                    .frame(width: 60)
                IconButton(systemIcon: "plus", size: 44) { stepZoom(Self.zoomStep) }
            }
            .frame(maxWidth: .infinity)

            HStack(spacing: Spacing.md) {
                GatherButton("Annuler", variant: .secondary, fullWidth: true) { onCancel() }
                GatherButton("Valider", systemIcon: "checkmark", fullWidth: true) { validate() }
            }
        }
    }

    private func stepZoom(_ delta: CGFloat) {
        withAnimation(.easeOut(duration: 0.15)) {
            zoom = min(Self.maxZoom, max(Self.minZoom, zoom + delta))
            baseZoom = zoom
            offset = clampedOffset(offset)
            baseOffset = offset
        }
        Haptics.light()
    }

    // MARK: - Crop

    private func validate() {
        let cropped = croppedImage() ?? image
        Haptics.success()
        onDone(cropped)
    }

    /// Crops the source image to exactly what the clear window shows.
    private func croppedImage() -> UIImage? {
        let normalized = image.orientedUp()
        guard let cg = normalized.cgImage else { return nil }
        let imgW = CGFloat(cg.width)
        let imgH = CGFloat(cg.height)
        guard imgW > 0, imgH > 0 else { return nil }

        let frame = frameSize
        let coverScale = max(frame.width / imgW, frame.height / imgH)
        let total = coverScale * zoom
        let cropW = frame.width / total
        let cropH = frame.height / total
        let originX = imgW / 2 - offset.width / total - cropW / 2
        let originY = imgH / 2 - offset.height / total - cropH / 2

        let rect = CGRect(x: originX, y: originY, width: cropW, height: cropH)
            .intersection(CGRect(x: 0, y: 0, width: imgW, height: imgH))
        guard !rect.isEmpty, let croppedCG = cg.cropping(to: rect.integral) else { return nil }
        return UIImage(cgImage: croppedCG)
    }
}

private extension UIImage {
    /// Redraws the image with an .up orientation so CGImage cropping math is correct.
    func orientedUp() -> UIImage {
        guard imageOrientation != .up else { return self }
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        return UIGraphicsImageRenderer(size: size, format: format).image { _ in
            draw(in: CGRect(origin: .zero, size: size))
        }
    }
}
