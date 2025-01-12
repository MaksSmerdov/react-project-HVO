import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import styles from './chart.module.scss';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Title,
  Tooltip,
  Legend,
  TimeScale,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import CrosshairPlugin from 'chartjs-plugin-crosshair';
import { useData } from './hooks/useData';
import { getChartOptions, colors } from './config/chartConfig';
import { handleBackward, handleForward, handleReturnToCurrent, createDataWithGaps } from './utils/chartUtils';
import IntervalSelector from './intervalSelector';
import { useInterval } from './context/intervalContext';

ChartJS.register(
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  CrosshairPlugin
);

interface UniversalChartProps {
  apiUrl: string;
  title: string;
  yMin?: number;
  yMax?: number;
  dataKey: string;
  params: { key: string; label: string; unit?: string }[];
  width?: number | string;
  height?: number | string;
  id: string;
  showIntervalSelector?: boolean;
}

interface GenericData {
  lastUpdated: string;
  [key: string]: any;
}

const UniversalChart: React.FC<UniversalChartProps> = ({
  apiUrl,
  title,
  yMin,
  yMax,
  dataKey,
  params,
  width = '100%',
  height = '400px',
  id,
  showIntervalSelector = true,
}) => {
  const chartRef = useRef<ChartJS<'line'> | null>(null);
  const { interval } = useInterval();
  const [startTime, setStartTime] = useState(new Date(Date.now() - interval * 60 * 1000));
  const [endTime, setEndTime] = useState(new Date());
  const { data, error, refetch } = useData(apiUrl, startTime, endTime);
  const [allHidden, setAllHidden] = useState(false);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [lastInteractionTime, setLastInteractionTime] = useState(Date.now());
  const [timeOffset, setTimeOffset] = useState(0); // Смещение графика в миллисекундах

  // Обновляем startTime и endTime с учетом смещения при изменении интервала
  useEffect(() => {
    const newEndTime = new Date(Date.now() - timeOffset);
    const newStartTime = new Date(newEndTime.getTime() - interval * 60 * 1000);
    setEndTime(newEndTime);
    setStartTime(newStartTime);
  }, [interval, timeOffset]);

  // Мемоизация данных
  const processedData = useMemo(() => data.map((item: GenericData) => ({
    time: new Date(item.lastUpdated),
    values: item[dataKey] || {},
  })), [data, dataKey]);

  const chartData = useMemo(() => ({
    labels: processedData.map((d) => d.time),
    datasets: params.map((param, index) => ({
      label: param.label,
      data: createDataWithGaps(processedData, param.key),
      borderColor: colors[index % colors.length],
      backgroundColor: colors[index % colors.length],
      spanGaps: false,
    })),
  }), [processedData, params]);

  const options = useMemo(() => getChartOptions(
    startTime.getTime(),
    endTime.getTime(),
    title,
    isAutoScroll,
    params,
    yMin,
    yMax,
  ), [startTime, endTime, title, isAutoScroll, params, yMin, yMax]);

  // Мемоизация обработчиков
  const handleBackwardWithInteraction = useCallback(() => {
    setLastInteractionTime(Date.now());
    const newOffset = timeOffset + interval * 60 * 1000; // Увеличиваем смещение
    setTimeOffset(newOffset);
    handleBackward(startTime, endTime, setStartTime, setEndTime, setIsAutoScroll);
  }, [startTime, endTime, interval, timeOffset]);

  const handleForwardWithInteraction = useCallback(() => {
    setLastInteractionTime(Date.now());
    const newOffset = Math.max(0, timeOffset - interval * 60 * 1000); // Уменьшаем смещение, но не меньше 0
    setTimeOffset(newOffset);
    handleForward(startTime, endTime, setStartTime, setEndTime, setIsAutoScroll);
  }, [startTime, endTime, interval, timeOffset]);

  const handleReturnToCurrentWithInteraction = useCallback(() => {
    setLastInteractionTime(Date.now());
    setTimeOffset(0); // Сбрасываем смещение
    handleReturnToCurrent(setStartTime, setEndTime, setIsAutoScroll, interval);
  }, [interval]);

  const handleToggleAll = useCallback(() => {
    if (chartRef.current) {
      chartRef.current.data.datasets.forEach((_, index) => {
        const meta = chartRef.current?.getDatasetMeta(index);
        if (meta) {
          meta.hidden = !allHidden;
        }
      });
      chartRef.current.update();
    }
    setAllHidden(!allHidden);
  }, [allHidden]);

  // Автоматическое обновление данных
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (isAutoScroll) {
        const newEndTime = new Date(Date.now() - timeOffset);
        const newStartTime = new Date(newEndTime.getTime() - interval * 60 * 1000);
        setEndTime(newEndTime);
        setStartTime(newStartTime);
        refetch();
      } else {
        refetch();
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [isAutoScroll, interval, refetch, timeOffset]);

  // Проверка бездействия пользователя
  useEffect(() => {
    const inactivityTimeout = 60 * 1000; // 1 минута
    const checkInactivity = () => {
      const currentTime = Date.now();
      if (currentTime - lastInteractionTime > inactivityTimeout && !isAutoScroll) {
        handleReturnToCurrent(setStartTime, setEndTime, setIsAutoScroll, interval);
      }
    };

    const intervalId = setInterval(checkInactivity, 1000); // Проверяем каждую секунду

    return () => clearInterval(intervalId);
  }, [lastInteractionTime, isAutoScroll, interval, setStartTime, setEndTime, setIsAutoScroll]);

  return (
    <div className={styles['chart-container']}>
      {showIntervalSelector && <IntervalSelector />}

      {error ? (
        <div className={styles['error-message']} style={{ width, height }}>
          Ошибка при загрузке данных. Связь с сервером/оборудованием отсутствует.
        </div>
      ) : (
        <div id={id} style={{ width, height }}>
          <Line ref={chartRef} data={chartData} options={{ ...options, responsive: true }} />
        </div>
      )}

      <div className={styles['dynamic-graph__btns']}>
        <button
          className={styles['dynamic-graph__btn']}
          onClick={handleBackwardWithInteraction}
        >
          Назад
        </button>
        <button
          className={styles['dynamic-graph__btn']}
          onClick={handleForwardWithInteraction}
        >
          Вперёд
        </button>
        <button className={styles['dynamic-graph__btn']} onClick={handleToggleAll}>
          {allHidden ? 'Показать все' : 'Скрыть все'}
        </button>
        <button
          className={styles['dynamic-graph__btn']}
          onClick={handleReturnToCurrentWithInteraction}
        >
          Вернуться к текущим данным
        </button>
      </div>
    </div>
  );
};

export default UniversalChart;