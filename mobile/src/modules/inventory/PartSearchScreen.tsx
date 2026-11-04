import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { COLORS } from '../../config/constants';
import apiClient from '../../services/api';

export const PartSearchScreen = ({ route }: any) => {
  const workOrderId = route.params?.workOrderId;
  const [search, setSearch] = useState('');
  const [parts, setParts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchParts = async (query = '') => {
    try {
      setLoading(true);
      const res: any = await apiClient.get(`/inventory/search?query=${encodeURIComponent(query)}&limit=20`);
      if (res.success && res.data) {
        setParts(res.data);
      }
    } catch (e: any) {
      console.warn('Part search failed:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParts('');
  }, []);

  const handleReserve = async (part: any) => {
    if (!workOrderId) {
      Alert.alert('Info', `Part ${part.part_number} is stored at Rack: ${part.rack_number}, Bin: ${part.bin_number}.`);
      return;
    }

    try {
      setLoading(true);
      const res: any = await apiClient.post('/inventory/reserve', {
        work_order_id: workOrderId,
        part_id: part.id,
        quantity: 1,
      });

      if (res.success) {
        Alert.alert('Reserved', `1 unit of ${part.part_number} reserved for active Work Order.`);
        fetchParts(search);
      }
    } catch (e: any) {
      Alert.alert('Stock Reservation Failed', e.message || 'Cannot reserve part.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Search Header */}
      <View style={styles.searchBarContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search 160k parts (e.g. 332/Y2415, valve, bearing)"
          placeholderTextColor="#94A3B8"
          value={search}
          onChangeText={(text) => {
            setSearch(text);
            fetchParts(text);
          }}
        />
      </View>

      {loading && <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 10 }} />}

      <FlatList
        data={parts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.partCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.partNumber}>{item.part_number}</Text>
              <View
                style={[
                  styles.stockBadge,
                  item.available_stock > 0 ? styles.stockIn : styles.stockOut,
                ]}
              >
                <Text
                  style={[
                    styles.stockText,
                    item.available_stock > 0 ? styles.textIn : styles.textOut,
                  ]}
                >
                  {item.available_stock > 0 ? `${item.available_stock} IN STOCK` : 'ZERO STOCK'}
                </Text>
              </View>
            </View>

            <Text style={styles.partName}>{item.name}</Text>
            <Text style={styles.partDesc}>{item.description}</Text>

            {/* Warehouse Bin Location */}
            <View style={styles.locationBox}>
              <Text style={styles.locationTitle}>Bin Location: </Text>
              <Text style={styles.locationValue}>
                {item.warehouse_zone} → Rack {item.rack_number} → Shelf {item.shelf_number} → Bin {item.bin_number}
              </Text>
            </View>

            {workOrderId && (
              <TouchableOpacity
                style={[
                  styles.reserveBtn,
                  item.available_stock <= 0 && styles.reserveBtnDisabled,
                ]}
                onPress={() => handleReserve(item)}
                disabled={item.available_stock <= 0}
              >
                <Text style={styles.reserveBtnText}>
                  {item.available_stock > 0 ? 'RESERVE FOR THIS WORK ORDER' : 'STOCK OUT - CREATE PR'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  searchBarContainer: {
    backgroundColor: COLORS.secondary,
    padding: 12,
  },
  searchInput: {
    height: 44,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 13,
    color: '#0F172A',
  },
  list: {
    padding: 14,
  },
  partCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  partNumber: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  stockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  stockIn: {
    backgroundColor: '#DCFCE7',
  },
  stockOut: {
    backgroundColor: '#FEE2E2',
  },
  stockText: {
    fontSize: 10,
    fontWeight: '800',
  },
  textIn: {
    color: '#15803D',
  },
  textOut: {
    color: '#B91C1C',
  },
  partName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  partDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  locationBox: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  locationTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  locationValue: {
    fontSize: 11,
    color: '#0F172A',
    fontWeight: '600',
  },
  reserveBtn: {
    backgroundColor: COLORS.primary,
    height: 38,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  reserveBtnDisabled: {
    backgroundColor: '#E2E8F0',
  },
  reserveBtnText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '800',
  },
});

