import { RefreshControl, ScrollView, StyleSheet, View, FlatList, ActivityIndicator } from 'react-native';
import { useDispatch, useSelector } from '../../store';
import * as React from 'react';
import { useEffect, useState } from 'react';
import useAuth from '../../hooks/useAuth';
import { PermissionEntity } from '../../models/role';
import {
  getLocationChildren,
  getLocations,
  getMoreLocations
} from '../../slices/location';
import { FilterField, SearchCriteria } from '../../models/page';
import {
  Button,
  Card,
  IconButton,
  List,
  Searchbar,
  Text,
  useTheme
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import Location from '../../models/location';
import { IconSource } from 'react-native-paper/src/components/Icon';
import { onSearchQueryChange } from '../../utils/overall';
import { RootStackScreenProps } from '../../types';
import { useDebouncedEffect } from '../../hooks/useDebouncedEffect';
import Tag from '../../components/Tag';

const LocationCard = React.memo(({
  location,
  navigation,
  showChildrenButton = false,
  onViewChildren
}: {
  location: Location;
  navigation: RootStackScreenProps<'Locations'>['navigation'];
  showChildrenButton?: boolean;
  onViewChildren?: () => void;
}) => {
  const { t } = useTranslation();
  return (
    <Card
      style={{
        marginVertical: 5,
        backgroundColor: 'white'
      }}
      onPress={() =>
        navigation.push('LocationDetails', {
          id: location.id,
          locationProp: location
        })
      }
    >
      <Card.Content>
        <List.Item
          titleStyle={{ fontWeight: 'bold' }}
          title={location.name}
          description={location.address}
          right={(props) => (
            <View>
              <Tag
                text={`#${location.customId}`}
                color="white"
                backgroundColor="#545454"
              />
            </View>
          )}
        />
      </Card.Content>
      {showChildrenButton && location.hasChildren && (
        <Card.Actions>
          <Button onPress={onViewChildren}>{t('view_children')}</Button>
        </Card.Actions>
      )}
    </Card>
  );
});

export default function LocationsScreen({
  navigation,
  route
}: RootStackScreenProps<'Locations'>) {
  const { t } = useTranslation();
  const [startedSearch, setStartedSearch] = useState<boolean>(false);
  const {
    locations,
    locationsHierarchy,
    loadingGet,
    currentPageNum,
    lastPage
  } = useSelector((state) => state.locations);
  const theme = useTheme();
  const [view, setView] = useState<'hierarchy' | 'list'>('hierarchy');
  const dispatch = useDispatch();
  const [searchQuery, setSearchQuery] = useState('');
  const { hasViewPermission } = useAuth();
  const defaultFilterFields: FilterField[] = [];
  const getCriteriaFromFilterFields = (filterFields: FilterField[]) => {
    // [MODIFICADO] Ordenamiento Predeterminado
    // Impacto: Fuerza el orden por 'name' ascendente.
    // Beneficio: Las ubicaciones aparecen ordenadas alfabéticamente (A-Z).
    const initialCriteria: SearchCriteria = {
      filterFields: defaultFilterFields,
      pageSize: 10,
      pageNum: 0,
      direction: 'ASC',
      sortField: 'name'
    };
    let newFilterFields = [...initialCriteria.filterFields];
    filterFields.forEach(
      (filterField) =>
      (newFilterFields = newFilterFields.filter(
        (ff) => ff.field != filterField.field
      ))
    );
    return {
      ...initialCriteria,
      filterFields: [...newFilterFields, ...filterFields]
    };
  };
  const [criteria, setCriteria] = useState<SearchCriteria>(
    getCriteriaFromFilterFields([])
  );
  useEffect(() => {
    if (hasViewPermission(PermissionEntity.LOCATIONS) && view === 'list') {
      dispatch(
        getLocations({
          ...criteria,
          pageSize: 10,
          pageNum: 0,
          direction: 'DESC'
        })
      );
    }
  }, [criteria]);
  const [currentLocations, setCurrentLocations] = useState([]);
  useEffect(() => {
    if (
      route.params?.id &&
      locationsHierarchy.some(
        (location) =>
          location.hierarchy.includes(route.params.id) &&
          location.id !== route.params.id
      )
    ) {
      return;
    }
    dispatch(
      getLocationChildren(route.params?.id ?? 0, route.params?.hierarchy ?? [])
    );
  }, [route]);

  const onRefresh = () => {
    setCriteria(getCriteriaFromFilterFields([]));
  };


  const onQueryChange = (query) => {
    onSearchQueryChange<Location>(
      query,
      criteria,
      setCriteria,
      setSearchQuery,
      ['name', 'address']
    );
    setView('list');
  };
  // [MODIFICADO] Optimización de Búsqueda: Debounce
  // Impacto: Reducido de 1000ms a 500ms.
  // Beneficio: La búsqueda se siente más rápida y responsiva.
  useDebouncedEffect(
    () => {
      if (startedSearch) onQueryChange(searchQuery);
    },
    [searchQuery],
    500
  );

  useEffect(() => {
    let result = [];
    if (route.params?.id) {
      result = locationsHierarchy.filter((location, index) => {
        return (
          location.hierarchy[location.hierarchy.length - 2] ===
          route.params.id && location.id !== route.params.id
        );
      });
    } else
      result = locationsHierarchy.filter(
        (location) => location.hierarchy.length === 1
      );
    setCurrentLocations(result);
  }, [locationsHierarchy]);

  // [MODIFICADO] Optimización de Rendimiento: useCallback
  // Impacto: Mantiene estable la referencia de la función entre renderizados.
  // Beneficio: Evita re-crear la función innecesariamente, ayudando a React.memo.
  const handleViewChildren = React.useCallback((location) => {
    navigation.push('Locations', {
      id: location.id,
      hierarchy: location.hierarchy
    });
  }, [navigation]);

  return (
    <View
      style={{ ...styles.container, backgroundColor: theme.colors.background }}
    >
      <Searchbar
        placeholder={t('search')}
        onFocus={() => setStartedSearch(true)}
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={{ backgroundColor: theme.colors.background }}
      />
      {view === 'list' ? (
        <FlatList
          style={styles.scrollView}
          data={locations.content}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <LocationCard location={item} navigation={navigation} />
          )}
          onEndReached={() => {
            if (!loadingGet && !lastPage) {
              dispatch(getMoreLocations(criteria, currentPageNum + 1));
            }
          }}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={loadingGet}
              onRefresh={onRefresh}
              colors={[theme.colors.primary]}
            />
          }
          ListFooterComponent={
            loadingGet && !locations.content.length ? (
              <ActivityIndicator
                animating={true}
                color={theme.colors.primary}
                style={{ margin: 10 }}
              />
            ) : null
          }
          ListEmptyComponent={
            !loadingGet ? (
              <View
                style={{
                  backgroundColor: 'white',
                  padding: 20,
                  borderRadius: 10
                }}
              >
                <Text variant={'titleLarge'}>
                  {t('no_element_match_criteria')}
                </Text>
              </View>
            ) : null
          }
          removeClippedSubviews={true}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
        />
      ) : (
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl
              refreshing={loadingGet}
              colors={[theme.colors.primary]}
            />
          }
        >
          {!!currentLocations.length &&
            currentLocations.map((location) => (
              <LocationCard
                key={location.id}
                location={location}
                navigation={navigation}
                showChildrenButton={true}
                onViewChildren={() => handleViewChildren(location)}
              />
            ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold'
  },
  scrollView: {
    width: '100%',
    height: '100%',
    padding: 5
  },
  row: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center'
  }
});
