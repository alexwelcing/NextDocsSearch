// Article manifest → public/arc/archive.json + archive-full.json. Must run after 50-article-manifest.
import { writeArchiveIndex } from '../../generate-archive-index'

export default function archiveIndex() {
  return writeArchiveIndex()
}
