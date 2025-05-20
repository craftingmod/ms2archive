import type { CustomReader as ByteReader } from "./CustomReader.ts"
import type { ICoordF } from "./DefCommon.ts"; // 실제 DefCommon.ts 경로로 수정
import { decodeCoordF } from "./DefCommon.ts";   // 실제 DefCommon.ts 경로로 수정

// by Gemini Code Assist
// Basic Ids for forcing branch logic
const CAP_ID_CATEGORY = 113; // 11300000 / 100000
const HAIR_ID_CATEGORY = 102; // 10200000 / 100000
const DECAL_ID_CATEGORY = 104; // 10400000 / 100000
// const PET_ID_CATEGORY = 600; // 60000000 / 100000 (decode_item에서 직접 사용)

const TEMPLATE_ITEM_IDS: number[] = [
    11050005, 11050006, 11300041, 11300042, 11300043, 11300044, 11300045, 11300046, 11300155, 11300156,
    11300157, 11300158, 11300697, 11300698, 11300699, 11300700, 11400024, 11400025, 11400026, 11400027,
    11400080, 11400081, 11400082, 11400083, 11400120, 11400121, 11400418, 11400419, 11400550, 11400551,
    11400607, 11400608, 11401077, 11401078, 11500024, 11500025, 11500026, 11500027, 11500081, 11500082,
    11500338, 11500339, 11500522, 11500523, 11500971, 11500972, 11600034, 11600035, 11700048, 11700049,
    11700173, 11700174, 11850005, 11850008, 11850180, 12200016, 12200017, 12200092, 12200093, 12200327,
    12200328, 12200331, 12200332, 13000070, 13100203, 13100319, 13200198, 13200314, 13300197, 13300310,
    13400196, 13400309, 14000162, 14000272, 14100171, 14100284, 15000202, 15000315, 15100194, 15100310,
    15200201, 15200314, 15300197, 15300310, 15400112, 15400296, 15500509, 15600509, 15600532, 50100189,
    50100385, 50200381, 50200382, 50200398, 50200399, 50200440, 50200486, 50200487, 50200488, 50200489,
    50200490, 50200649, 50200700, 50200701, 50200702, 50200703, 50200738, 50200739, 50200740, 50200741,
    50200742, 50200743, 50200744, 50200745, 50200746, 50200747, 50200748, 50200749, 50200750, 50200751,
    50200752, 50200753, 50200754, 50200755, 50200756, 50200787, 50200878, 50200879, 50200880, 50200881,
    50200882, 50200883, 50200884, 50200885, 50400088, 50400089, 50400228, 50600045, 50600054, 50600060,
    50600066, 50600072, 50600078, 50600084, 50600089, 50600090, 50600278
];
const BLUEPRINT_ITEM_ID = 35200000;

export interface EquipColor {
    color1: number;
    color2: number;
    color3: number;
    colorIndex: number;
    palette: number;
}

export function decodeEquipColor(reader: ByteReader): EquipColor {
    return {
        color1: reader.readInt(),
        color2: reader.readInt(),
        color3: reader.readInt(),
        colorIndex: reader.readInt(),
        palette: reader.readInt(),
    };
}

export interface CapPosition {
    position1: ICoordF;
    position2: ICoordF;
    position3: ICoordF;
    position4: ICoordF;
    unknownFloat: number;
}

export interface HairPosition {
    backLength: number;
    backPosition1: ICoordF;
    backPosition2: ICoordF;
    frontLength: number;
    frontPosition1: ICoordF;
    frontPosition2: ICoordF;
}

export interface DecalPosition {
    position1: number;
    position2: number;
    position3: number;
    position4: number;
}

export interface ItemExtraData {
    equipColor: EquipColor;
    itemCategory: string; // Corresponds to add_field(str(id // 100000))
    cap?: CapPosition;
    hair?: HairPosition;
    decal?: DecalPosition;
}

export function decodeItemExtraData(reader: ByteReader, id: number): ItemExtraData {
    const equipColor = decodeEquipColor(reader);
    const itemCategoryNum = Math.floor(id / 100000);
    const data: ItemExtraData = {
        equipColor,
        itemCategory: String(itemCategoryNum),
    };

    if (itemCategoryNum === CAP_ID_CATEGORY) {
        data.cap = {
            position1: decodeCoordF(reader),
            position2: decodeCoordF(reader),
            position3: decodeCoordF(reader),
            position4: decodeCoordF(reader),
            unknownFloat: reader.readFloat(),
        };
    } else if (itemCategoryNum === HAIR_ID_CATEGORY) {
        data.hair = {
            backLength: reader.readFloat(),
            backPosition1: decodeCoordF(reader),
            backPosition2: decodeCoordF(reader),
            frontLength: reader.readFloat(),
            frontPosition1: decodeCoordF(reader),
            frontPosition2: decodeCoordF(reader),
        };
    } else if (itemCategoryNum === DECAL_ID_CATEGORY) {
        data.decal = {
            position1: reader.readFloat(),
            position2: reader.readFloat(),
            position3: reader.readFloat(),
            position4: reader.readFloat(),
        };
    }
    return data;
}

function internalDecodeStatOption(reader: ByteReader): number {
    return reader.readFloat()
}

function internalDecodeSpecialOption(reader: ByteReader): number {
    return reader.readFloat()
}

export interface StatOptionEntry {
    statType: number;
    floatValue: number; // float
}

export interface SpecialOptionEntry {
    statType: number;
    floatValue: number; // float
}

export interface StatBlock {
    statOptions: StatOptionEntry[];
    specialOptions: SpecialOptionEntry[];
}

export interface ItemStats {
    constantStats: StatBlock;
    staticStats: StatBlock;
    randomStats: StatBlock;
    titleStats: StatBlock;
    empowermentStats: StatBlock; // Python code had a loop for 1 iteration
    unknownEmpowermentInt: number;
}

export function decodeItemStats(reader: ByteReader): ItemStats {
    const result: Partial<ItemStats> = {};
    const statCategories = ["Static", "Constant", "Title", "Random"];

    for (const category of statCategories) {
        const statOptions: StatOptionEntry[] = [];
        let count = reader.readShort();
        for (let j = 0; j < count; j++) {
            statOptions.push({
                statType: reader.readShort(),
                floatValue: internalDecodeStatOption(reader),
            });
        }

        const specialOptions: SpecialOptionEntry[] = [];
        count = reader.readShort();
        for (let j = 0; j < count; j++) {
            specialOptions.push({
                statType: reader.readShort(),
                floatValue: internalDecodeSpecialOption(reader),
            });
        }
        (result as Record<string, unknown>)[`${category.toLowerCase()}Stats`] = { statOptions, specialOptions };
    }

    // Empowerment Stats (originally loop for 1 iteration)
    const empowermentStatOptions: StatOptionEntry[] = [];
    let empCount = reader.readShort();
    for (let j = 0; j < empCount; j++) {
        empowermentStatOptions.push({
            statType: reader.readShort(),
            floatValue: internalDecodeStatOption(reader),
        });
    }
    const empowermentSpecialOptions: SpecialOptionEntry[] = [];
    empCount = reader.readShort();
    for (let j = 0; j < empCount; j++) {
        empowermentSpecialOptions.push({
            statType: reader.readShort(),
            floatValue: internalDecodeSpecialOption(reader),
        });
    }
    result.empowermentStats = { statOptions: empowermentStatOptions, specialOptions: empowermentSpecialOptions };
    result.unknownEmpowermentInt = reader.readInt();

    return result as ItemStats;
}

export interface EnchantStatEntry {
    statType: number;
    floatValue: number;
}
export interface ItemEnchant {
    enchants: number;
    enchantExp: number;
    enchantBasedChargeExp: number;
    unknownLong1: bigint;
    unknownInt1: number;
    unknownInt2: number;
    canRepackage: boolean;
    enchantCharges: number;
    enchantStats: EnchantStatEntry[];
}

export function decodeItemEnchant(reader: ByteReader): ItemEnchant {
    const options = {
        enchants: reader.readInt(),
        enchantExp: reader.readInt(),
        enchantBasedChargeExp: reader.readByte(),
        unknownLong1: reader.readLong(),
        unknownInt1: reader.readInt(),
        unknownInt2: reader.readInt(),
        canRepackage: reader.readBoolean(),
        enchantCharges: reader.readInt(),
    }

    const enchantStats: EnchantStatEntry[] = [];
    const count = reader.readByte();
    for (let i = 0; i < count; i++) {
        enchantStats.push({
            statType: reader.readInt(),
            floatValue: internalDecodeStatOption(reader),
        });
    }
    return {
        ...options,
        enchantStats,
    };
}

export interface ItemLimitBreak {
    limitBreakLevel: number;
    limitBreakStatOptions: StatOptionEntry[];
    limitBreakSpecialOptions: SpecialOptionEntry[];
}

export function decodeItemLimitBreak(reader: ByteReader): ItemLimitBreak {
    const limitBreakLevel = reader.readInt()
    
    const limitBreakStatOptions: StatOptionEntry[] = [];
    let count = reader.readInt();
    for (let i = 0; i < count; i++) {
        limitBreakStatOptions.push({
            statType: reader.readShort(),
            floatValue: internalDecodeStatOption(reader),
        });
    }

    const limitBreakSpecialOptions: SpecialOptionEntry[] = [];
    count = reader.readInt();
    for (let i = 0; i < count; i++) {
        limitBreakSpecialOptions.push({
            statType: reader.readShort(),
            floatValue: internalDecodeSpecialOption(reader),
        });
    }
    return {
        limitBreakLevel,
        limitBreakStatOptions,
        limitBreakSpecialOptions,
    };
}

export interface UgcItemLook {
    uid: bigint;
    uuid: string;
    itemName: string;
    unknownByte: number;
    unknownInt: number;
    accountId: bigint;
    characterId: bigint;
    characterName: string;
    creationTime: bigint;
    ugcUrl: string;
    unknownByte2: number;
}

export function decodeUgcItemLook(reader: ByteReader): UgcItemLook {
    return {
        uid: reader.readLong(),
        uuid: reader.readString(),
        itemName: reader.readString(),
        unknownByte: reader.readByte(),
        unknownInt: reader.readInt(),
        accountId: reader.readLong(),
        characterId: reader.readLong(),
        characterName: reader.readString(),
        creationTime: reader.readLong(),
        ugcUrl: reader.readString(),
        unknownByte2: reader.readByte(),
    };
}

export interface UgcItemMusicScore { // CUgcItemMusicNote
    unknownLong1: bigint;
    unknownInt1: number;
    unknownInt2: number;
    unknownString1: string;
    unknownString2: string;
    unknownAsciiString: string; // Python: add_str, assuming readString handles it or needs specific ASCII reader
    unknownInt3: number;
    unknownLong2: bigint;
    unknownLong3: bigint;
    unknownString3: string;
}

export function decodeUgcItemMusicScore(reader: ByteReader): UgcItemMusicScore {
    return {
        unknownLong1: reader.readLong(),
        unknownInt1: reader.readInt(),
        unknownInt2: reader.readInt(),
        unknownString1: reader.readString(),
        unknownString2: reader.readString(),
        unknownAsciiString: reader.readString(), // Adjust if ByteReader has specific ASCII method
        unknownInt3: reader.readInt(),
        unknownLong2: reader.readLong(),
        unknownLong3: reader.readLong(),
        unknownString3: reader.readString(),
    };
}

export interface BlueprintItemData {
    unknownLong1: bigint;
    unknownInt1: number;
    unknownInt2: number;
    unknownInt3: number;
    unknownLong2: bigint;
    unknownInt4: number;
    unknownLong3: bigint;
    unknownLong4: bigint;
    unknownString: string;
}

export function decodeBlueprintItemData(reader: ByteReader): BlueprintItemData {
    return {
        unknownLong1: reader.readLong(),
        unknownInt1: reader.readInt(),
        unknownInt2: reader.readInt(),
        unknownInt3: reader.readInt(),
        unknownLong2: reader.readLong(),
        unknownInt4: reader.readInt(),
        unknownLong3: reader.readLong(),
        unknownLong4: reader.readLong(),
        unknownString: reader.readString(),
    };
}

export interface TransparencyBadge {
    headgear: boolean;
    eyewear: boolean;
    top: boolean;
    bottom: boolean;
    cape: boolean;
    earrings: boolean;
    face: boolean;
    gloves: boolean;
    unknown: boolean;
    shoes: boolean;
}

export interface BadgeData {
    unknownByte: number;
    badgeType: number;
    badgeID: number;
    petSkinId?: number; // For PetSkinBadge
    transparency?: TransparencyBadge; // For Transparency badge
}

export function decodeBadge(reader: ByteReader, id: number): BadgeData {
    const data: BadgeData = {
        unknownByte: reader.readByte(),
        badgeType: reader.readByte(),
        badgeID: reader.readInt(),
    };
    if (id === 70100000) { // PetSkinBadge
        data.petSkinId = reader.readInt();
    } else if (id === 70100001) { // Transparency
        data.transparency = {
            headgear: reader.readBoolean(),
            eyewear: reader.readBoolean(),
            top: reader.readBoolean(),
            bottom: reader.readBoolean(),
            cape: reader.readBoolean(),
            earrings: reader.readBoolean(),
            face: reader.readBoolean(),
            gloves: reader.readBoolean(),
            unknown: reader.readBoolean(),
            shoes: reader.readBoolean(),
        };
    }
    return data;
}

export interface ItemMusicScore {
    scoreLength: number;
    instrument: number;
    scoreTitle: string;
    author: string;
    unknownInt1: number;
    authorCharacterId: bigint;
    isLocked: number; // byte
    unknownLong1: bigint;
    unknownLong2: bigint;
}

export function decodeItemMusicScore(reader: ByteReader): ItemMusicScore {
    return {
        scoreLength: reader.readInt(),
        instrument: reader.readInt(),
        scoreTitle: reader.readString(),
        author: reader.readString(),
        unknownInt1: reader.readInt(),
        authorCharacterId: reader.readLong(),
        isLocked: reader.readByte(),
        unknownLong1: reader.readLong(),
        unknownLong2: reader.readLong(),
    };
}

export interface ItemPet {
    petName: string;
    petExp: bigint;
    unknownInt: number;
    petLevel: number;
    unknownByte: number;
}

export function decodeItemPet(reader: ByteReader): ItemPet {
    return {
        petName: reader.readString(),
        petExp: reader.readLong(),
        unknownInt: reader.readInt(),
        petLevel: reader.readInt(),
        unknownByte: reader.readByte(),
    };
}

export interface ItemBinding {
    boundToCharId: bigint;
    boundToName: string;
}

export function decodeItemBinding(reader: ByteReader): ItemBinding {
    return {
        boundToCharId: reader.readLong(),
        boundToName: reader.readString(),
    };
}

export interface ItemTransfer {
    transferFlag: number;
    mailReceived: boolean;
    remainingTrades: number;
    remainingRepackageCount: number;
    unknownByte: number;
    unknownBoolean: boolean;
    isBound: number; // byte
    bindingInfo?: ItemBinding;
}

export function decodeItemTransfer(reader: ByteReader): ItemTransfer {
    const data: ItemTransfer = {
        transferFlag: reader.readInt(),
        mailReceived: reader.readBoolean(),
        remainingTrades: reader.readInt(),
        remainingRepackageCount: reader.readInt(),
        unknownByte: reader.readByte(),
        unknownBoolean: reader.readBoolean(),
        isBound: reader.readByte(),
    };
    if (data.isBound !== 0) {
        data.bindingInfo = decodeItemBinding(reader);
    }
    return data;
}

export interface GemstoneLockInfo {
    isLockedSecondary: boolean; // Second add_bool("IsLocked")
    unlockTime: bigint;
}

export interface Gemstone {
    gemstoneItemId: number;
    isBound: boolean;
    bindingInfo?: ItemBinding;
    isLockedPrimary: boolean; // First add_bool("IsLocked")
    lockInfo?: GemstoneLockInfo;
}

export function decodeGemstone(reader: ByteReader): Gemstone {
    const data: Gemstone = {
        gemstoneItemId: reader.readInt(),
        isBound: reader.readBoolean(),
        isLockedPrimary: false,
    };
    if (data.isBound) {
        data.bindingInfo = decodeItemBinding(reader);
    }
    data.isLockedPrimary = reader.readBoolean();
    if (data.isLockedPrimary) {
        data.lockInfo = {
            isLockedSecondary: reader.readBoolean(), // The second "IsLocked" boolean
            unlockTime: reader.readLong(),
        };
    }
    return data;
}

export interface GemSocketEntry {
    isUnlocked: boolean;
    gemstone?: Gemstone;
}

export interface GemSockets {
    maxSockets: number;
    totalSockets: number;
    sockets: GemSocketEntry[];
}

export function decodeGemSockets(reader: ByteReader): GemSockets {
    const maxSockets = reader.readByte();
    const totalSockets = reader.readByte();
    const sockets: GemSocketEntry[] = [];
    for (let i = 0; i < totalSockets; i++) {
        const isUnlocked = reader.readBoolean();
        if (isUnlocked) {
            sockets.push({ isUnlocked: true, gemstone: decodeGemstone(reader) });
        } else {
            sockets.push({ isUnlocked: false });
        }
    }
    return { maxSockets, totalSockets, sockets };
}

export interface ItemCoupleInfo {
    pairedCharacterId: bigint;
    pairedName?: string;
    unknownBoolean?: boolean;
}

export function decodeItemCoupleInfo(reader: ByteReader): ItemCoupleInfo {
    const pairedCharacterId = reader.readLong();
    const data: ItemCoupleInfo = { pairedCharacterId };
    if (pairedCharacterId !== 0n) { // Compare with bigint zero
        data.pairedName = reader.readString();
        data.unknownBoolean = reader.readBoolean();
    }
    return data;
}

export interface Item {
    itemId: number; // Original id passed to decode_item
    amount: number;
    unknownInt1: number;
    creationTime: bigint;
    expiryTime: bigint;
    unknownLong1: bigint;
    timesChangedAttribute: number;
    remainingUses: number;
    isLockedByte: number; // byte
    unlockTime: bigint;
    glamorForges: number;
    unknownBoolean1: boolean;
    unknownInt2: number;

    itemExtraData: ItemExtraData;
    itemStats: ItemStats;
    itemEnchant: ItemEnchant;
    itemLimitBreak: ItemLimitBreak;

    ugcItemLook?: UgcItemLook;
    blueprintItemData?: BlueprintItemData;
    pet?: ItemPet;
    musicScore?: ItemMusicScore;
    badge?: BadgeData;

    itemTransfer: ItemTransfer;
    gemSockets: GemSockets;
    itemCoupleInfo: ItemCoupleInfo;
    itemBinding: ItemBinding; // Final item binding
}

export function decodeItem(reader: ByteReader, id: number): Item {
    const item: Partial<Item> = { itemId: id };

    item.amount = reader.readInt();
    item.unknownInt1 = reader.readInt();
    item.creationTime = reader.readLong();
    item.expiryTime = reader.readLong();
    item.unknownLong1 = reader.readLong();
    item.timesChangedAttribute = reader.readInt();
    item.remainingUses = reader.readInt();
    item.isLockedByte = reader.readByte();
    item.unlockTime = reader.readLong();
    item.glamorForges = reader.readShort();
    item.unknownBoolean1 = reader.readBoolean();
    item.unknownInt2 = reader.readInt();

    item.itemExtraData = decodeItemExtraData(reader, id);
    item.itemStats = decodeItemStats(reader);
    item.itemEnchant = decodeItemEnchant(reader);
    item.itemLimitBreak = decodeItemLimitBreak(reader);
    if (TEMPLATE_ITEM_IDS.includes(id) || id === BLUEPRINT_ITEM_ID) {
        item.ugcItemLook = decodeUgcItemLook(reader);
        item.blueprintItemData = decodeBlueprintItemData(reader);
    }

    const itemCategory100k = Math.floor(id / 100000);
    if (itemCategory100k === 600 || itemCategory100k === 610 || itemCategory100k === 611 || itemCategory100k === 629) {
        item.pet = decodeItemPet(reader);
    }
    if (itemCategory100k === 351) {
        item.musicScore = decodeItemMusicScore(reader);
    }

    const itemCategory1M = Math.floor(id / 1000000);
    if (itemCategory1M === 70) {
        item.badge = decodeBadge(reader, id);
    }

    item.itemTransfer = decodeItemTransfer(reader);
    item.gemSockets = decodeGemSockets(reader);
    item.itemCoupleInfo = decodeItemCoupleInfo(reader);
    item.itemBinding = decodeItemBinding(reader); // The last decode_item_binding call
    return item as Item;
}

export interface CubeItemInfo {
    itemId: number;
    itemUid: bigint;
    unknownLong: bigint;
    isUgc: boolean;
    ugcItemLook?: UgcItemLook;
}

export function decodeCubeItemInfo(reader: ByteReader): CubeItemInfo {
    const data: CubeItemInfo = {
        itemId: reader.readInt(),
        itemUid: reader.readLong(),
        unknownLong: reader.readLong(),
        isUgc: reader.readBoolean(),
    };
    if (data.isUgc) {
        data.ugcItemLook = decodeUgcItemLook(reader);
    }
    return data;
}

export interface ItemEntity {
    itemId: number;
    rarity: number; // short
    amount: number;
    unknownBool1: boolean;
    unknownBool2: boolean;
    unknownBool3: boolean;
    unknownBool4: boolean;
}

export function decodeItemEntity(reader: ByteReader): ItemEntity {
    return {
        itemId: reader.readInt(),
        rarity: reader.readShort(),
        amount: reader.readInt(),
        unknownBool1: reader.readBoolean(),
        unknownBool2: reader.readBoolean(),
        unknownBool3: reader.readBoolean(),
        unknownBool4: reader.readBoolean(),
    };
}