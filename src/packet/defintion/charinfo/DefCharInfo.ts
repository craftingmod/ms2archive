import type { ISkinColor } from "../DefCommon.ts"; // DefCommon.ts 경로를 실제 경로로 수정해주세요.
import { decodeSkinColor } from "../DefCommon.ts"; ;           // DefCommon.ts 경로를 실제 경로로 수정해주세요.
import type { Item, UgcItemLook } from "../DefItem.ts";                   // DefItem.ts 경로를 실제 경로로 수정해주세요.
import { decodeItem } from "../DefItem.ts";                 // DefItem.ts 경로를 실제 경로로 수정해주세요.
import type { CustomReader as ByteReader } from "../CustomReader.ts"

export interface SpecialStatEntry {
    type: number; // short
    value: number; // int
}

export interface CharacterStatsAndInfo {
    bufferSize: number;
    accountId: bigint;
    characterId: bigint;
    name: string;
    level: number; // short
    jobGroupId: number;
    jobId: number;
    gender: number;
    prestige: number;
    unknownByte1: number;
    basicStats: bigint[][]; // 3 sets of 35 longs
    specialStats: SpecialStatEntry[];
    profileUrl: string;
    motto: string;
    guildName: string;
    guildRank: string;
    houseName: string;
    unknownField: Uint8Array; // 12 bytes from add_field
    titleId: number;
    unlockedTitles: number[];
    trophyCount: number;
    gearScore: number;
    timestamp: bigint;
    unknownLong1: bigint;
    skinColor: ISkinColor;
    martialStatus: number; // short
    spouse1Name: string;
    spouse2Name: string;
    proposalTimestamp: bigint;
    unknownLong2: bigint;
}

function decodeCharacterStatsAndInfoInternal(reader: ByteReader): CharacterStatsAndInfo {
    const bufferSize = reader.readInt();
    const accountId = reader.readLong();
    const characterId = reader.readLong();
    const name = reader.readUnicodeString();
    const level = reader.readShort();
    const jobGroupId = reader.readInt();
    const jobId = reader.readInt();
    const gender = reader.readInt();
    const prestige = reader.readInt();
    const unknownByte1 = reader.readByte();

    const basicStats: bigint[][] = [];
    for (let x = 0; x < 3; x++) {
        const statSet: bigint[] = [];
        for (let i = 0; i < 35; i++) {
            statSet.push(reader.readLong());
        }
        basicStats.push(statSet);
    }

    const specialStatCount = reader.readInt();
    const specialStats: SpecialStatEntry[] = [];
    for (let i = 0; i < specialStatCount; i++) {
        specialStats.push({
            type: reader.readShort(),
            value: reader.readInt(),
        });
    }

    const profileUrl = reader.readString();
    const motto = reader.readString();
    const guildName = reader.readString();
    const guildRank = reader.readString();
    const houseName = reader.readString();

    const unknownField = reader.readBytes(12)

    const titleId = reader.readInt();
    const unlockedTitlesCount = reader.readInt();
    const unlockedTitles: number[] = [];
    for (let i = 0; i < unlockedTitlesCount; i++) {
        unlockedTitles.push(reader.readInt());
    }
    const trophyCount = reader.readInt();
    const gearScore = reader.readInt();
    const timestamp = reader.readLong();
    const unknownLong1 = reader.readLong();
    const skinColor = decodeSkinColor(reader);
    const martialStatus = reader.readShort();
    const spouse1Name = reader.readString();
    const spouse2Name = reader.readString();
    const proposalTimestamp = reader.readLong();
    const unknownLong2 = reader.readLong();


    return {
        bufferSize,
        accountId,
        characterId,
        name,
        level,
        jobGroupId,
        jobId,
        gender,
        prestige,
        unknownByte1,
        basicStats,
        specialStats,
        profileUrl,
        motto,
        guildName,
        guildRank,
        houseName,
        unknownField,
        titleId,
        unlockedTitles,
        trophyCount,
        gearScore,
        timestamp,
        unknownLong1,
        skinColor,
        martialStatus,
        spouse1Name,
        spouse2Name,
        proposalTimestamp,
        unknownLong2,
    };
}

export interface EquippedItemInfo {
    id: number;
    uid: bigint;
    equipType: number; // byte
    rarity: number;
    itemData: Item;
}

export interface CharacterEquipmentAndSkin {
    bufferSize: number;
    equipment: EquippedItemInfo[];
    hasSkin: boolean;
    unknownLong1: bigint;
    unknownLong2: bigint;
    skinItems: EquippedItemInfo[];
}

function decodeCharacterEquipmentAndSkinInternal(reader: ByteReader): CharacterEquipmentAndSkin {
    const bufferSize = reader.readInt();
    const equipmentCount = reader.readByte();
    const equipment: EquippedItemInfo[] = [];
    for (let j = 0; j < equipmentCount; j++) {
        const id = reader.readInt();
        const uid = reader.readLong()
        const equipType = reader.readByte()
        const rarity = reader.readInt()
        const itemData = decodeItem(reader, id)
        equipment.push({
            id,
            uid,
            equipType,
            rarity,
            itemData,
        });
    }

    const hasSkin = reader.readBoolean();
    const unknownLong1 = reader.readLong();
    const unknownLong2 = reader.readLong();

    const skinCount = reader.readByte();
    const skinItems: EquippedItemInfo[] = [];
    for (let j = 0; j < skinCount; j++) {
        const id = reader.readInt();
        skinItems.push({
            id,
            uid: reader.readLong(),
            equipType: reader.readByte(),
            rarity: reader.readInt(),
            itemData: decodeItem(reader, id),
        });
    }
    return { bufferSize, equipment, hasSkin, unknownLong1, unknownLong2, skinItems };
}

export interface BadgeItemInfo {
    slot: number; // byte
    itemId: number;
    uid: bigint;
    rarity: number;
    itemData: Item;
}

export interface CharacterBadges {
    bufferSize: number;
    badges: BadgeItemInfo[];
}

function decodeCharacterBadgesInternal(reader: ByteReader): CharacterBadges {
    const bufferSize = reader.readInt();
    const badgeCount = reader.readByte();
    const badges: BadgeItemInfo[] = [];
    for (let j = 0; j < badgeCount; j++) {
        const itemInfo = {
            slot: reader.readByte(),
            itemId: reader.readInt(),
            uid: reader.readLong(),
            rarity: reader.readInt(),
        }
        badges.push({
            ...itemInfo,
            itemData: decodeItem(reader, itemInfo.itemId),
        })
    }
    return { bufferSize, badges };
}

export interface DetailedCharacterInfo {
    unknownLongBeforeBuffers: bigint;
    characterIdForBuffers: bigint;
    currentTime: bigint;
    statsAndInfo: CharacterStatsAndInfo;
    equipmentAndSkin: CharacterEquipmentAndSkin;
    badges: CharacterBadges;
}

export interface CharacterInfoPacket {
    characterId: bigint;
    hasDetails: boolean;
    details?: DetailedCharacterInfo;
}

export function decodeCharacterInfoPacket(reader: ByteReader): CharacterInfoPacket {
    const characterId = reader.readLong();
    const hasDetails = reader.readBoolean();

    if (hasDetails) {
        const unknownLongBeforeBuffers = reader.readLong();
        const characterIdForBuffers = reader.readLong();
        const currentTime = reader.readLong();
        const statsAndInfo = decodeCharacterStatsAndInfoInternal(reader);
        const equipmentAndSkin = decodeCharacterEquipmentAndSkinInternal(reader);
        const badges = decodeCharacterBadgesInternal(reader);

        return {
            characterId,
            hasDetails: true,
            details: {
                unknownLongBeforeBuffers,
                characterIdForBuffers,
                currentTime,
                statsAndInfo,
                equipmentAndSkin,
                badges,
            },
        };
    } else {
        return {
            characterId,
            hasDetails: false,
        };
    }
}

export function extractUgcItemLook(data: CharacterInfoPacket) {
  const results = [] as UgcItemLook[];

  if (data.details != null) {
    for (const skin of data.details.equipmentAndSkin.skinItems) {
      const ugcLook = skin.itemData.ugcItemLook
      if (ugcLook != null) {
        results.push(ugcLook)
      }
    }
  }
  
  return results;
}