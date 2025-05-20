import type { CustomReader as ByteReader } from "./CustomReader.ts" // 실제 DefCommon.ts 경로로 수정해주세요.

/**
 * Represents the decoded values of a single stat.
 * The `isModified` flag indicates if the total value differs from the current value.
 */
export interface DecodedStatResult {
    total: number | bigint;
    base: number | bigint;
    current: number | bigint;
    isModified: boolean;
}

/**
 * Decodes a single stat based on its type.
 * Stat type 4 (HP) uses bigint, others use number.
 * @param reader The ByteReader instance.
 * @param statType The type of the stat to decode.
 * @returns A DecodedStatResult object.
 */
export function decodeStat(reader: ByteReader, statType: number): DecodedStatResult {
    let total: number | bigint;
    let base: number | bigint;
    let current: number | bigint;

    if (statType === 4) { // Hp
        total = reader.readLong();
        base = reader.readLong();
        current = reader.readLong();
    } else {
        total = reader.readInt();
        base = reader.readInt();
        current = reader.readInt();
    }
    return {
        total,
        base,
        current,
        isModified: total !== current,
    };
}

/**
 * Represents a specific stat, including its type and decoded values.
 */
export interface SpecificStat {
    statType: number;
    values: DecodedStatResult;
}

/**
 * Decodes a specific stat entry, which includes reading its type first.
 * @param reader The ByteReader instance.
 * @returns A SpecificStat object.
 */
export function decodeSpecificStat(reader: ByteReader): SpecificStat {
    const statType = reader.readByte();
    const values = decodeStat(reader, statType);
    return {
        statType,
        values,
    };
}

/**
 * Represents a set of delta values for player stats (Total, Base, Current).
 */
export interface PlayerDeltaStatValues {
    health: bigint;
    atkSpd: number;
    moveSpd: number;
    mountSpd: number;
    jumpHeight: number;
}

/**
 * Represents the complete delta stats for a player.
 */
export interface PlayerDeltaStats {
    total: PlayerDeltaStatValues;
    base: PlayerDeltaStatValues;
    current: PlayerDeltaStatValues;
}

export function decodePlayerDeltaStats(reader: ByteReader): PlayerDeltaStats {
    const result: Partial<PlayerDeltaStats> = {};
    const categories = ["total", "base", "current"] as const;

    for (const category of categories) {
        result[category] = {
            health: reader.readLong(),
            atkSpd: reader.readInt(),
            moveSpd: reader.readInt(),
            mountSpd: reader.readInt(),
            jumpHeight: reader.readInt(),
        };
    }
    return result as PlayerDeltaStats;
}

/**
 * Represents a set of delta values for NPC stats (Total, Base, Current).
 */
export interface NpcDeltaStatValues {
    health: bigint;
    atkSpd: number;
}

/**
 * Represents the complete delta stats for an NPC.
 */
export interface NpcDeltaStats {
    total: NpcDeltaStatValues;
    base: NpcDeltaStatValues;
    current: NpcDeltaStatValues;
}

export function decodeNpcDeltaStats(reader: ByteReader): NpcDeltaStats {
    const result: Partial<NpcDeltaStats> = {};
    const categories = ["total", "base", "current"] as const;

    for (const category of categories) {
        result[category] = {
            health: reader.readLong(),
            atkSpd: reader.readInt(),
        };
    }
    return result as NpcDeltaStats;
}

export interface NpcStatsInfo {
    count: number;
    data: SpecificStat | NpcDeltaStats;
}

export function decodeNpcStats(reader: ByteReader): NpcStatsInfo {
    const count = reader.readByte();
    let data: SpecificStat | NpcDeltaStats;
    if (count === 1) {
        data = decodeSpecificStat(reader);
    } else {
        data = decodeNpcDeltaStats(reader);
    }
    return { count, data };
}

export interface PlayerStatsInfo {
    count: number;
    data: PlayerDeltaStats | SpecificStat[];
}

export function decodePlayerStats(reader: ByteReader): PlayerStatsInfo {
    const count = reader.readByte();
    let data: PlayerDeltaStats | SpecificStat[];

    if (count === 35) {
        data = decodePlayerDeltaStats(reader);
    } else {
        const specificStats: SpecificStat[] = [];
        for (let i = 0; i < count; i++) {
            specificStats.push(decodeSpecificStat(reader));
        }
        data = specificStats;
    }
    return { count, data };
}

export interface MyPlayerIndividualStat {
    statIndex: number; // Original index used as statType
    values: DecodedStatResult;
}

export interface MyPlayerStatsInfo {
    count: number;
    data: MyPlayerIndividualStat[] | SpecificStat[];
}

export function decodeMyPlayerStats(reader: ByteReader): MyPlayerStatsInfo {
    const count = reader.readByte();
    let data: MyPlayerIndividualStat[] | SpecificStat[];

    if (count === 35) {
        const individualStats: MyPlayerIndividualStat[] = [];
        for (let i = 0; i < 35; i++) { // Loop 35 times, using 'i' as statType
            individualStats.push({
                statIndex: i,
                values: decodeStat(reader, i),
            });
        }
        data = individualStats;
    } else {
        const specificStats: SpecificStat[] = [];
        for (let i = 0; i < count; i++) {
            specificStats.push(decodeSpecificStat(reader));
        }
        data = specificStats;
    }
    return { count, data };
}