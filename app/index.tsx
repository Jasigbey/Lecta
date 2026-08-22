import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, FlatList, Image, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';

const { width, height } = Dimensions.get('window');

const slides = [
  {
    id: '1',
    image: require('../assets/onboarding_study.jpg'),
    bg: '#e8f5f0',
    title: 'Stay on Top of\nYour Classes.',
    subtitle: 'Track assignments, deadlines, and your full class schedule — all in one place.',
  },
  {
    id: '2',
    image: require('../assets/onboarding_chat.jpg'),
    bg: '#eef0ff',
    title: 'Connect With\nYour Class.',
    subtitle: 'Message classmates and class reps instantly. Share notes and never miss an update.',
  },
  {
    id: '3',
    image: require('../assets/onboarding_ai.jpg'),
    bg: '#f3eeff',
    title: 'Study Smarter\nWith AI.',
    subtitle: 'Get instant answers, generate quizzes, and summarize your notes with your AI tutor.',
  },
];

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const goNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    }
  };

  const isLastSlide = currentIndex === slides.length - 1;
  const currentBg = slides[currentIndex].bg;

  return (
    <View style={[styles.root, { backgroundColor: currentBg }]}>
      <StatusBar barStyle="dark-content" backgroundColor={currentBg} />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brand}>Lecta</Text>
          <Link href="/login" replace asChild>
            <TouchableOpacity>
              <Text style={styles.skip}>Skip</Text>
            </TouchableOpacity>
          </Link>
        </View>

        {/* Slides */}
        <FlatList
          ref={flatListRef}
          data={slides}
          horizontal
          pagingEnabled
          scrollEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          onMomentumScrollEnd={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.x / width);
            setCurrentIndex(index);
          }}
          renderItem={({ item }) => (
            <View style={styles.slide}>
              {/* Illustration */}
              <View style={styles.imageContainer}>
                <Image source={item.image} style={styles.image} resizeMode="cover" />
              </View>

              {/* Text */}
              <View style={styles.textBlock}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.subtitle}>{item.subtitle}</Text>
              </View>
            </View>
          )}
        />

        {/* Footer: dots + button */}
        <View style={styles.footer}>
          {/* Pagination dots */}
          <View style={styles.dots}>
            {slides.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === currentIndex ? styles.dotActive : styles.dotInactive,
                ]}
              />
            ))}
          </View>

          {/* Next / Get Started button */}
          {isLastSlide ? (
            <Link href="/login" replace asChild>
              <TouchableOpacity style={styles.btn} activeOpacity={0.85}>
                <Text style={styles.btnText}>Get Started</Text>
                <ArrowRight size={20} color="#fff" />
              </TouchableOpacity>
            </Link>
          ) : (
            <TouchableOpacity style={styles.btn} onPress={goNext} activeOpacity={0.85}>
              <Text style={styles.btnText}>Next</Text>
              <ArrowRight size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  brand: { fontSize: 20, fontWeight: '800', color: '#0f172a', letterSpacing: 1 },
  skip: { fontSize: 16, fontWeight: '600', color: '#64748b' },

  slide: {
    width,
    paddingHorizontal: 24,
    alignItems: 'center',
  },

  imageContainer: {
    width: width - 48,
    height: height * 0.42,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    marginBottom: 40,
  },
  image: {
    width: '100%',
    height: '100%',
  },

  textBlock: {
    alignSelf: 'flex-start',
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 40,
    marginBottom: 14,
  },
  subtitle: {
    fontSize: 16,
    color: '#475569',
    lineHeight: 26,
    fontWeight: '400',
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
  },

  dots: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dot: { borderRadius: 99, height: 8 },
  dotActive: { width: 28, backgroundColor: '#1d4ed8' },
  dotInactive: { width: 8, backgroundColor: '#cbd5e1' },

  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1d4ed8',
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 999,
    shadowColor: '#1d4ed8',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  btnText: { color: '#ffffff', fontWeight: '800', fontSize: 16 },
});
