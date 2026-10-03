from .config import Settings
from .matching import ClipEmbedder

if __name__ == "__main__":
    embedder = ClipEmbedder(Settings())
    vector = embedder.encode("a blue backpack")
    print(f"Real CLIP model ready: {len(vector)} dimensions")
