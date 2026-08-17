import { Profile } from '@/types';

/**
 * 휴대폰 번호를 회원 식별 Key로 사용하기 위한 공용 유틸과,
 * 구글 간편가입 회원의 기본정보 입력 완료 여부 판정을 모아둔 모듈.
 */

export const DUPLICATE_PHONE_MESSAGE = '동일한 연락처가 존재합니다. 아이디 찾기로 회원 정보를 찾아주세요.';

/** 저장 형식(하이픈 유무)에 관계없이 비교할 수 있도록 숫자만 남긴다. */
export const normalizePhone = (value?: string | null) => (value || '').replace(/[^0-9]/g, '');

/**
 * 010-0000-0000 형태로 입력값을 정리한다.
 * 011/016 등 10자리 번호는 011-000-0000처럼 3-3-4로 끊는다.
 */
export const formatPhoneNumber = (value: string) => {
  const numbers = normalizePhone(value).slice(0, 11);
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  if (numbers.length === 10 && !numbers.startsWith('010')) {
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 6)}-${numbers.slice(6)}`;
  }
  return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
};

/** 국내 휴대폰 번호(10~11자리) 형식 검증. */
export const isValidMobilePhone = (value: string) => {
  const numbers = normalizePhone(value);
  return /^01[016789]\d{7,8}$/.test(numbers);
};

/** 구글 간편가입 회원이 반드시 채워야 하는 기본정보 항목. */
export const getMissingProfileFields = (profile?: Profile | null) => {
  if (!profile) return [];
  const missing: string[] = [];
  if (!profile.name) missing.push('이름(실명)');
  if (!profile.nickname) missing.push('닉네임');
  if (!(profile.mobile_phone || profile.phone)) missing.push('휴대폰 번호');
  if (!profile.gender) missing.push('성별');
  if (!profile.birthdate) missing.push('생년월일');
  return missing;
};

/**
 * 구글 간편가입 회원은 기본정보를 모두 저장해야 가입이 최종 완료된 것으로 본다.
 * 그 전까지는 서비스 이용이 제한된다.
 */
export const isProfileIncomplete = (profile?: Profile | null, provider?: string | null) => {
  if (!profile) return false;
  if (provider !== 'google') return false;
  return getMissingProfileFields(profile).length > 0;
};

/** 기본정보 입력을 마쳐야 하는 회원이 이동해야 할 경로. */
export const PROFILE_COMPLETION_PATH = '/mypage?tab=settings';
