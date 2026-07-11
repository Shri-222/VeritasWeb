# Change Detection

VeritasWeb records a bounded comparison after a successful capture when a prior
capture has downloadable HTML and screenshot artifacts.

- Readable text is extracted by removing script, style, comment, and markup text.
- Whitespace is normalized and added/removed segments are capped at 40 entries.
- Metadata compares title, final URL, status, selected response headers, and
  screenshot hash.
- The score is a small UI signal from text and metadata differences. It is not a
  scientific, forensic, or legal significance measure.
- Visual pixel comparison is explicitly unavailable in the current build; a
  future decoder may add a private visual diff artifact without changing hashes.

Raw captured HTML is never injected into the React DOM or executed.

