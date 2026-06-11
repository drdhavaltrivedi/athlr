import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Dimensions,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BarChart } from 'react-native-chart-kit';
import {
  activitiesForDay,
  calendarData,
  weekStats,
  monthStats,
} from '@/db/database';
import { ActivitySummary, DayActivity, WeekStats } from '@/types';
import { colors, radii, spacing, type } from '@/theme';
import {
  formatDate,
  formatDistance,
  formatDuration,
  formatTime,
  SPORT_ICON,
  SPORT_COLOR,
  SPORT_LABEL,
  distanceUnit,
} from '@/utils/format';
import { useRecordingStore } from '@/store/recordingStore';

const DAYS_OF_WEEK = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export default function LogScreen() {
  const router = useRouter();
  const units = useRecordingStore((s) => s.units);
  const [calendar, setCalendar] = useState<DayActivity[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayActivities, setDayActivities] = useState<ActivitySummary[]>([]);
  const [week, setWeek] = useState<WeekStats | null>(null);
  const [month, setMonth] = useState<WeekStats | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useFocusEffect(
    useCallback(() => {
      Promise.all([calendarData(90), weekStats(), monthStats()]).then(
        ([cal, w, m]) => {
          setCalendar(cal);
          setWeek(w);
          setMonth(m);
        },
      );
    }, []),
  );

  const onDayPress = async (date: string) => {
    if (selectedDate === date) {
      setSelectedDate(null);
      setDayActivities([]);
      return;
    }
    setSelectedDate(date);
    const acts = await activitiesForDay(date);
    setDayActivities(acts);
  };

  // Build calendar grid for currentMonth
  const calMap = new Map(calendar.map((d) => [d.date, d]));
  const year = currentMonth.getFullYear();
  const month0 = currentMonth.getMonth();
  const firstDay = new Date(year, month0, 1);
  // Monday = 0
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  // Build flat array: nulls for blank leading days, then 1..daysInMonth
  const cells: Array<number | null> = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const monthLabel = currentMonth.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const prevMonth = () =>
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () =>
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.m, gap: spacing.l }}>
      
      <Text style={[type.h2, { marginBottom: spacing.xs, marginTop: spacing.s }]}>Training Log</Text>

      {/* This week */}
      {week && (
        <View style={styles.card}>
          <Text style={type.label}>This Week</Text>
          <View style={styles.statRow}>
            <StatItem icon="bicycle" label="Activities" value={String(week.activities)} />
            <StatItem icon="location" label={`Dist · ${distanceUnit(units)}`} value={formatDistance(week.distanceM, units, 1)} />
            <StatItem icon="time" label="Time" value={formatDuration(week.movingS)} />
            <StatItem icon="trending-up" label="Elev · m" value={String(Math.round(week.elevationGainM))} />
          </View>
          
          {/* Week Chart */}
          {calendar.length >= 7 && (
            <View style={{ marginTop: spacing.l, alignItems: 'center' }}>
              <BarChart
                data={{
                  labels: DAYS_OF_WEEK,
                  datasets: [
                    {
                      data: calendar.slice(-7).map(d => Number(formatDistance(d.distanceM, units, 1)))
                    }
                  ]
                }}
                width={Dimensions.get("window").width - spacing.m * 2 - spacing.l * 2}
                height={160}
                yAxisLabel=""
                yAxisSuffix=""
                withInnerLines={false}
                showValuesOnTopOfBars={true}
                fromZero={true}
                chartConfig={{
                  backgroundColor: colors.surface,
                  backgroundGradientFrom: colors.surface,
                  backgroundGradientTo: colors.surface,
                  decimalPlaces: 0,
                  color: (opacity = 1) => colors.accent,
                  labelColor: (opacity = 1) => colors.textDim,
                  barPercentage: 0.6,
                }}
                style={{
                  borderRadius: radii.card,
                  paddingRight: 0,
                }}
              />
            </View>
          )}
        </View>
      )}

      {/* This month */}
      {month && (
        <StatCard title="This Month" stats={month} units={units} />
      )}

      {/* Calendar */}
      <View style={styles.card}>
        {/* Month navigator */}
        <View style={styles.monthNav}>
          <Pressable onPress={prevMonth} style={styles.navBtn}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </Pressable>
          <Text style={type.title}>{monthLabel}</Text>
          <Pressable onPress={nextMonth} style={styles.navBtn}>
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </Pressable>
        </View>

        {/* Day headers */}
        <View style={styles.weekRow}>
          {DAYS_OF_WEEK.map((d) => (
            <Text key={d} style={styles.dayHeader}>{d}</Text>
          ))}
        </View>

        {/* Calendar grid */}
        <View style={styles.grid}>
          {cells.map((day, idx) => {
            if (day === null) {
              return <View key={`blank-${idx}`} style={styles.dayCell} />;
            }
            const dateStr = `${year}-${String(month0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const data = calMap.get(dateStr);
            const isToday =
              new Date().toISOString().slice(0, 10) === dateStr;
            const isSelected = selectedDate === dateStr;
            const intensity = data
              ? Math.min(1, data.distanceM / 10000)
              : 0;

            return (
              <Pressable
                key={dateStr}
                style={[
                  styles.dayCell,
                  isSelected && styles.dayCellSelected,
                  isToday && styles.dayCellToday,
                ]}
                onPress={() => data && onDayPress(dateStr)}
              >
                {data && (
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor:
                          colors.accent +
                          Math.round(intensity * 200 + 55)
                            .toString(16)
                            .padStart(2, '0'),
                        width: 28 + intensity * 6,
                        height: 28 + intensity * 6,
                      },
                    ]}
                  />
                )}
                <Text
                  style={[
                    styles.dayNum,
                    data ? styles.dayNumActive : {},
                    isToday && styles.dayNumToday,
                  ]}
                >
                  {day}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Selected day activities */}
      {selectedDate && dayActivities.length > 0 && (
        <View style={styles.card}>
          <Text style={type.label}>{formatDate(new Date(selectedDate + 'T00:00:00').getTime())}</Text>
          {dayActivities.map((a) => (
            <Pressable
              key={a.id}
              style={styles.dayRow}
              onPress={() => router.push(`/activity/${a.id}`)}
            >
              <View style={[styles.dayRowIcon, { backgroundColor: (SPORT_COLOR[a.sport] ?? colors.accent) + '22' }]}>
                <Ionicons name={SPORT_ICON[a.sport] as never} size={16} color={SPORT_COLOR[a.sport] ?? colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={type.body} numberOfLines={1}>{a.title}</Text>
                <Text style={type.caption}>
                  {formatTime(a.startedAt)} · {formatDistance(a.distanceM, units)} {distanceUnit(units)} · {formatDuration(a.movingS)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  title,
  stats,
  units,
}: {
  title: string;
  stats: WeekStats;
  units: 'km' | 'mi';
}) {
  return (
    <View style={styles.card}>
      <Text style={type.label}>{title}</Text>
      <View style={styles.statRow}>
        <StatItem icon="bicycle" label="Activities" value={String(stats.activities)} />
        <StatItem icon="location" label={`Distance · ${distanceUnit(units)}`} value={formatDistance(stats.distanceM, units, 1)} />
        <StatItem icon="time" label="Moving Time" value={formatDuration(stats.movingS)} />
        <StatItem icon="trending-up" label="Elev · m" value={String(Math.round(stats.elevationGainM))} />
      </View>
    </View>
  );
}

function StatItem({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.statItem}>
      <Ionicons name={icon as never} size={16} color={colors.accent} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={type.label}>{label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.m,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.m,
  },

  statRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },

  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navBtn: { padding: spacing.s },

  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.s,
  },
  dayHeader: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: colors.textDim,
    letterSpacing: 0.5,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dayCellSelected: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 8,
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: colors.textDim,
    borderRadius: 8,
  },
  dot: {
    position: 'absolute',
    borderRadius: 99,
    opacity: 0.6,
  },
  dayNum: {
    fontSize: 13,
    color: colors.textDim,
    fontWeight: '500',
    zIndex: 1,
  },
  dayNumActive: { color: colors.text, fontWeight: '700' },
  dayNumToday: { color: colors.accent },

  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    paddingVertical: spacing.s,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dayRowIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
