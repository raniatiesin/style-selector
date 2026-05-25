# The SRT node is a game changer

### **The problem the node solves**

When TTS generates audio, it doesn't care about your timestamps — it just produces however many seconds of speech the text naturally takes. So if "Hello, welcome to the show" generates 4 seconds of audio but your SRT only gave it a 2-second slot, the audio overruns into the next line's territory and they collide.

The node's "smart natural" timing mode detects this and shifts later segments forward to make room, instead of just letting them crash into each other.

### **The caching part**

Say you have a 50-line SRT and you only fix a typo in line 12. Without caching, the node would regenerate all 50 lines. With segment-level caching, it recognizes lines 1–11 and 13–50 haven't changed and only regenerates line 12. This makes iteration very fast.

### **The Adjusted_SRT output**

Since the audio for each line may end up longer or shorter than the original timestamps, the node outputs a _new_ SRT file with updated timestamps reflecting where the audio actually landed. This is useful if you're syncing the speech to video — you use the adjusted file, not the original.

I need to test out higgs's model. since it's topping VibeVoice.

## BIG NOTE

**4. CONNECTED Speakers + Native mode** This is what I got wrong earlier. They have:

- `CharacterVoicesNode` (belinda.wav) → `speaker2_voice` on VibeVoice Engine
- `CharacterVoicesNode` (Clint_Eastwood.wav) → `speaker3_voice`
- `CharacterVoicesNode` (female_02.wav) → `speaker4_voice`
- `CharacterVoicesNode` (David_Attenborough.wav) → `opt_narrator` on TTS Text

And the text uses `[Alice]`, `[Bob]` tags — which automatically map to Speaker 2, 3, 4 slots in order. The note in the workflow confirms: narrator = Speaker 1, first tag = Speaker 2, second tag = Speaker 3, etc.

Never using this ->

**5. Custom mode WITHOUT connected voices — tags only**

```
On Tuesdays, the pigeons held parliament.
[Alice] They debated the ethics of breadcrumbs.
[Bob] One philosophical pigeon named Thistle...
[Cowboy] He once floated for three minutes...
```

No CharacterVoicesNode connected at all. The TTS Text node has `David_Attenborough CC3.wav` selected directly in the **narrator_voice dropdown**. The characters `[Alice]`, `[Bob]`, `[Cowboy]` resolve to voice files from the voices folder by filename.

