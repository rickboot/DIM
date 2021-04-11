import { createSelector } from 'reselect';
import { ItemInfos } from './dim-item-info';
import { itemInfosSelector } from './selectors';

/**
 * all hashtags used in existing item notes
 */
export const allNotesHashtagsSelector = createSelector(itemInfosSelector, collectNotesHashtags);

/**
 * collects all hashtags from item notes
 */
export function collectNotesHashtags(itemInfos: ItemInfos) {
  // collect hash tags from item notes
  const hashTags = new Set<string>();
  for (const info of Object.values(itemInfos)) {
    const matches = getHashtagsFromNote(info.notes);
    if (matches) {
      for (const match of matches) {
        hashTags.add(match);
      }
    }
  }
  return [...hashTags];
}

export function getHashtagsFromNote(note?: string | null) {
  return [...(note?.matchAll(/#\w+/g) ?? [])].map((m) => m[0]);
}
