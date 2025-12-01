
export const formatSLNumber = (num: string) => {
  const cleaned = num.replace(/\D/g, ''); // Remove non-digits
  
  // Handle 10-digit format (077...)
  if (cleaned.length === 10 && cleaned.startsWith('0')) {
    return '94' + cleaned.substring(1);
  }
  // Handle 9-digit format (77...)
  if (cleaned.length === 9) {
    return '94' + cleaned;
  }
  // Handle existing international format
  if (cleaned.startsWith('94')) {
    return cleaned;
  }
  return cleaned; // Return as is if unknown format
};

export const formatTime12H = (time24: string) => {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':').map(Number);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${suffix}`;
};
