import { LoadoutParameters } from '@destinyitemmanager/dim-api-types';
import ClosableContainer from 'app/dim-ui/ClosableContainer';
import { t } from 'app/i18next-t';
import ConnectedInventoryItem from 'app/inventory/ConnectedInventoryItem';
import DraggableInventoryItem from 'app/inventory/DraggableInventoryItem';
import ItemPopupTrigger from 'app/inventory/ItemPopupTrigger';
import { InventoryBucket } from 'app/inventory/inventory-buckets';
import { DimItem, PluggableInventoryItemDefinition } from 'app/inventory/item-types';
import { bucketsSelector, storesSelector } from 'app/inventory/selectors';
import { Loadout, ResolvedLoadoutItem } from 'app/loadout-drawer/loadout-types';
import { getLoadoutStats, singularBucketHashes } from 'app/loadout-drawer/loadout-utils';
import { useD2Definitions } from 'app/manifest/selectors';
import { AppIcon, addIcon, faTshirt } from 'app/shell/icons';
import { LoadoutStats } from 'app/store-stats/CharacterStats';
import { emptyArray } from 'app/utils/empty';
import { itemCanBeInLoadout } from 'app/utils/item-utils';
import { Portal } from 'app/utils/temp-container';
import { LookupTable } from 'app/utils/util-types';
import { DestinyClass } from 'bungie-api-ts/destiny2';
import clsx from 'clsx';
import { BucketHashes } from 'data/d2/generated-enums';
import _ from 'lodash';
import React, { useState } from 'react';
import { DropTargetHookSpec, useDrop } from 'react-dnd';
import { useSelector } from 'react-redux';
import FashionDrawer from '../fashion/FashionDrawer';
import { BucketPlaceholder } from '../loadout-ui/BucketPlaceholder';
import { FashionMods } from '../loadout-ui/FashionMods';
import LoadoutParametersDisplay from '../loadout-ui/LoadoutParametersDisplay';
import { OptimizerButton } from '../loadout-ui/OptimizerButton';
import styles from './LoadoutEditBucket.m.scss';

export type EditableCategories = 'Weapons' | 'Armor' | 'General';

const categoryStyles: LookupTable<EditableCategories, string> = {
  Weapons: styles.categoryWeapons,
  Armor: styles.categoryArmor,
  General: styles.categoryGeneral,
};

export default function LoadoutEditBucket({
  category,
  classType,
  storeId,
  items,
  modsByBucket,
  onClickPlaceholder,
  onClickWarnItem,
  onRemoveItem,
  onToggleEquipped,
  children,
}: {
  category: EditableCategories;
  classType: DestinyClass;
  storeId: string;
  items?: ResolvedLoadoutItem[];
  modsByBucket: {
    [bucketHash: number]: number[] | undefined;
  };
  onClickPlaceholder: (params: { bucket: InventoryBucket; equip: boolean }) => void;
  onClickWarnItem: (resolvedItem: ResolvedLoadoutItem) => void;
  onToggleEquipped: (resolvedItem: ResolvedLoadoutItem) => void;
  onRemoveItem: (resolvedItem: ResolvedLoadoutItem) => void;
  children?: React.ReactNode;
}) {
  const buckets = useSelector(bucketsSelector)!;
  const itemsByBucket = _.groupBy(items, (li) => li.item.bucket.hash);
  const bucketOrder =
    category === 'Weapons' || category === 'Armor'
      ? buckets.byCategory[category]
      : [BucketHashes.Ghost, BucketHashes.Emblems, BucketHashes.Ships, BucketHashes.Vehicle].map(
          (h) => buckets.byHash[h]
        );
  const isArmor = category === 'Armor';

  return (
    <div className={clsx(styles.itemCategory, categoryStyles[category])}>
      <div className={styles.itemsInCategory}>
        {bucketOrder.map((bucket) => (
          <ItemBucket
            key={bucket.hash}
            bucket={bucket}
            category={category}
            classType={classType}
            items={itemsByBucket[bucket.hash]}
            onClickPlaceholder={onClickPlaceholder}
            onClickWarnItem={onClickWarnItem}
            onRemoveItem={onRemoveItem}
            onToggleEquipped={onToggleEquipped}
            equippedContent={
              isArmor && (
                <FashionMods
                  modsForBucket={modsByBucket[bucket.hash] ?? emptyArray()}
                  storeId={storeId}
                />
              )
            }
          />
        ))}
      </div>
      {children}
    </div>
  );
}

export function ArmorExtras({
  loadout,
  storeId,
  subclass,
  allMods,
  items,
  onModsByBucketUpdated,
}: {
  loadout: Loadout;
  storeId: string;
  subclass?: ResolvedLoadoutItem;
  allMods: PluggableInventoryItemDefinition[];
  items?: ResolvedLoadoutItem[];
  onModsByBucketUpdated: (modsByBucket: LoadoutParameters['modsByBucket']) => void;
}) {
  const defs = useD2Definitions()!;
  const equippedItems =
    items?.filter((li) => li.loadoutItem.equip && !li.missing).map((li) => li.item) ?? [];

  return (
    <>
      {equippedItems.length === 5 && (
        <div className="stat-bars destiny2">
          <LoadoutStats
            showTier
            stats={getLoadoutStats(defs, loadout.classType, subclass, equippedItems, allMods)}
          />
        </div>
      )}
      {loadout.parameters && <LoadoutParametersDisplay params={loadout.parameters} />}
      <div className={styles.buttons}>
        <FashionButton
          loadout={loadout}
          items={items ?? emptyArray()}
          storeId={storeId}
          onModsByBucketUpdated={onModsByBucketUpdated}
        />
        <OptimizerButton loadout={loadout} />
      </div>
    </>
  );
}

function ItemBucket({
  bucket,
  classType,
  category,
  items,
  equippedContent,
  onClickPlaceholder,
  onClickWarnItem,
  onRemoveItem,
  onToggleEquipped,
}: {
  bucket: InventoryBucket;
  classType: DestinyClass;
  category: EditableCategories;
  items: ResolvedLoadoutItem[];
  equippedContent?: React.ReactNode;
  onClickPlaceholder: (params: { bucket: InventoryBucket; equip: boolean }) => void;
  onClickWarnItem: (resolvedItem: ResolvedLoadoutItem) => void;
  onRemoveItem: (resolvedItem: ResolvedLoadoutItem) => void;
  onToggleEquipped: (resolvedItem: ResolvedLoadoutItem) => void;
}) {
  const bucketHash = bucket.hash;
  const [equipped, unequipped] = _.partition(items, (li) => li.loadoutItem.equip);

  const stores = useSelector(storesSelector);
  const buckets = useSelector(bucketsSelector)!;

  const dropSpec =
    (type: 'equipped' | 'unequipped') =>
    (): DropTargetHookSpec<
      DimItem,
      { equipped: boolean },
      { isOver: boolean; canDrop: boolean }
    > => ({
      accept: [bucket.hash.toString(), ...stores.flatMap((store) => `${store.id}-${bucket.hash}`)],
      drop: () => ({ equipped: type === 'equipped' }),
      canDrop: (i) =>
        itemCanBeInLoadout(i) &&
        (i.classType === DestinyClass.Unknown || classType === i.classType) &&
        (type === 'equipped' || !singularBucketHashes.includes(i.bucket.hash)),
      collect: (monitor) => ({
        isOver: monitor.isOver() && monitor.canDrop(),
        canDrop: monitor.canDrop(),
      }),
    });

  const [{ isOver: isOverEquipped, canDrop: canDropEquipped }, equippedRef] = useDrop(
    dropSpec('equipped'),
    [category, stores, buckets]
  );

  const [{ isOver: isOverUnequipped, canDrop: canDropUnequipped }, unequippedRef] = useDrop(
    dropSpec('unequipped'),
    [category, stores, buckets]
  );

  const handlePlaceholderClick = (equip: boolean) => onClickPlaceholder({ bucket, equip });

  // TODO: plumb through API from context??
  // T0DO: customize buttons in item popup?
  // TODO: draggable items?

  const maxSlots = singularBucketHashes.includes(bucket.hash) ? 1 : bucket.capacity;
  const showAddUnequipped = equipped.length > 0 && unequipped.length < maxSlots - 1;

  const addUnequipped = showAddUnequipped && (
    <button
      type="button"
      key="addbutton"
      className={styles.addButton}
      onClick={() => handlePlaceholderClick(false)}
      title={t('Loadouts.AddUnequippedItems')}
    >
      <AppIcon icon={addIcon} />
    </button>
  );

  const renderItem = (li: ResolvedLoadoutItem) => (
    <DraggableItem
      key={li.item.id}
      resolvedLoadoutItem={li}
      onClickWarnItem={() => onClickWarnItem(li)}
      onRemoveItem={() => onRemoveItem(li)}
      onToggleEquipped={() => onToggleEquipped(li)}
    />
  );

  return (
    <div className={clsx(styles.itemBucket)}>
      <div
        ref={equippedRef}
        className={clsx(styles.dropTarget, {
          [styles.canDrop]: canDropEquipped,
          [styles.isOver]: isOverEquipped,
        })}
      >
        {equipped.length > 0 ? (
          <div className={clsx(styles.items, styles.equipped)}>
            {equipped.map(renderItem)}
            {equippedContent}
          </div>
        ) : (
          <div className={clsx(styles.items, styles.equipped)}>
            <BucketPlaceholder
              bucketHash={bucketHash}
              onClick={() => handlePlaceholderClick(true)}
            />
            {equippedContent}
          </div>
        )}
      </div>
      <div
        ref={unequippedRef}
        className={clsx(styles.dropTarget, {
          [styles.canDrop]: canDropUnequipped,
          [styles.isOver]: isOverUnequipped,
        })}
      >
        {unequipped.length > 0 ? (
          <div ref={unequippedRef} className={clsx(styles.items, styles.unequipped)}>
            {unequipped.map(renderItem)}
            {addUnequipped}
          </div>
        ) : (
          addUnequipped
        )}
      </div>
    </div>
  );
}

function DraggableItem({
  resolvedLoadoutItem,
  onClickWarnItem,
  onRemoveItem,
  onToggleEquipped,
}: {
  resolvedLoadoutItem: ResolvedLoadoutItem;
  onClickWarnItem: () => void;
  onRemoveItem: () => void;
  onToggleEquipped: () => void;
}) {
  return (
    <ClosableContainer
      key={resolvedLoadoutItem.item.id}
      onClose={onRemoveItem}
      showCloseIconOnHover
    >
      <DraggableInventoryItem item={resolvedLoadoutItem.item}>
        <ItemPopupTrigger
          item={resolvedLoadoutItem.item}
          extraData={{ socketOverrides: resolvedLoadoutItem.loadoutItem.socketOverrides }}
        >
          {(ref, onClick) => (
            <div
              className={clsx({
                [styles.missingItem]: resolvedLoadoutItem.missing,
              })}
            >
              <ConnectedInventoryItem
                item={resolvedLoadoutItem.item}
                innerRef={ref}
                onClick={resolvedLoadoutItem.missing ? onClickWarnItem : onClick}
                onDoubleClick={onToggleEquipped}
              />
            </div>
          )}
        </ItemPopupTrigger>
      </DraggableInventoryItem>
    </ClosableContainer>
  );
}

function FashionButton({
  loadout,
  items,
  storeId,
  onModsByBucketUpdated,
}: {
  loadout: Loadout;
  items: ResolvedLoadoutItem[];
  storeId: string;
  onModsByBucketUpdated: (modsByBucket: LoadoutParameters['modsByBucket']) => void;
}) {
  const [showFashionDrawer, setShowFashionDrawer] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setShowFashionDrawer(true)}
        className="dim-button loadout-add"
      >
        <AppIcon icon={faTshirt} /> {t('Loadouts.Fashion')}
      </button>
      {showFashionDrawer && (
        <Portal>
          <FashionDrawer
            loadout={loadout}
            items={items}
            storeId={storeId}
            onModsByBucketUpdated={onModsByBucketUpdated}
            onClose={() => setShowFashionDrawer(false)}
          />
        </Portal>
      )}
    </>
  );
}
