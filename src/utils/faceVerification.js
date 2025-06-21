// eslint-disable-next-line no-unused-vars
import * as faceapi from 'face-api.js';

// Import Firebase modules safely
let firebase = null;
let app = null;
let db = null;
let collection = null;
let addDoc = null;
let query = null;
let getDocs = null;

try {
  // Dynamic imports for Firebase
  firebase = require('firebase/app');
  const firestoreModule = require('firebase/firestore');
  const { firebaseConfig } = require('../config/firebase.config');
  
  // Initialize Firebase
  app = firebase.initializeApp(firebaseConfig);
  db = firestoreModule.getFirestore(app);
  collection = firestoreModule.collection;
  addDoc = firestoreModule.addDoc;
  query = firestoreModule.query;
  getDocs = firestoreModule.getDocs;
  console.log('Firebase initialized successfully');
} catch (error) {
  console.warn('Firebase initialization skipped:', error.message);
  
  // Keep all variables null
}

// Function to generate face vector from detection data
export const generateFaceVector = (detection) => {
  if (!detection || !detection.descriptor) {
    throw new Error('Invalid face detection data');
  }
  return Array.from(detection.descriptor);
};

// Function to encrypt face vector
export const encryptFaceVector = (vector) => {
  if (!vector || !Array.isArray(vector)) {
    throw new Error('Invalid face vector');
  }
  // For now, we'll just store the vector as is
  // In production, you should implement proper encryption
  return vector;
};

// Function to decrypt face vector
export const decryptFaceVector = (encryptedVector) => {
  if (!encryptedVector || !Array.isArray(encryptedVector)) {
    throw new Error('Invalid encrypted vector');
  }
  // For now, we'll just return the vector as is
  // In production, you should implement proper decryption
  return encryptedVector;
};

// Function to calculate similarity between two vectors
export const calculateSimilarity = (vector1, vector2) => {
  try {
    // Ensure vectors are arrays and have the same length
    if (!Array.isArray(vector1) || !Array.isArray(vector2)) {
      console.error('Invalid vector format:', { vector1, vector2 });
      throw new Error('Vectors must be arrays');
    }

    if (vector1.length !== vector2.length) {
      console.error('Vector length mismatch:', { 
        vector1Length: vector1.length, 
        vector2Length: vector2.length 
      });
      throw new Error('Vectors must be of same length');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vector1.length; i++) {
      const v1 = Number(vector1[i]);
      const v2 = Number(vector2[i]);
      
      if (isNaN(v1) || isNaN(v2)) {
        console.error('Invalid vector values at index', i, { v1, v2 });
        throw new Error('Invalid vector values');
      }

      dotProduct += v1 * v2;
      norm1 += v1 * v1;
      norm2 += v2 * v2;
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
      console.warn('Zero norm detected:', { norm1, norm2 });
      return 0;
    }

    const similarity = dotProduct / (norm1 * norm2);
    return similarity;
  } catch (error) {
    console.error('Error in calculateSimilarity:', error);
    throw error;
  }
};

// Function to store face vector in Firebase
export const storeFaceVector = async (faceVector) => {
  // Check if Firebase is available
  if (!db || !collection || !addDoc) {
    console.warn('Firebase is not available, skipping face vector storage');
    return false;
  }
  
  try {
    if (!Array.isArray(faceVector)) {
      throw new Error('Invalid face vector format');
    }

    const faceVectorsRef = collection(db, 'faceVectors');
    const timestamp = new Date().toISOString();
    
    const docRef = await addDoc(faceVectorsRef, {
      vector: faceVector,
      timestamp: timestamp
    });

    console.log('Successfully stored face vector with ID:', docRef.id);
    return true;
  } catch (error) {
    console.error('Error storing face vector:', error);
    return false; // Don't throw, just return false
  }
};

// Function to check for existing face vectors
export const checkExistingFaceVector = async (faceVector) => {
  // Check if Firebase is available
  if (!db || !collection || !query || !getDocs) {
    console.warn('Firebase is not available, skipping face vector check');
    return false;
  }
  
  try {
    if (!Array.isArray(faceVector)) {
      throw new Error('Invalid face vector format');
    }

    console.log('Checking for existing face vector...');
    const faceVectorsRef = collection(db, 'faceVectors');
    
    // We're not filtering by wallet address in this implementation
    // since the Firebase where function isn't imported
    const q = query(faceVectorsRef);
    const querySnapshot = await getDocs(q);
    
    console.log('Found', querySnapshot.docs.length, 'existing vectors');
    
    // Return the most similar face found
    let highestSimilarity = 0;
    let bestMatch = null;
    
    for (const doc of querySnapshot.docs) {
      const storedData = doc.data();
      const storedVector = storedData.vector;
      
      if (!Array.isArray(storedVector)) {
        console.warn('Invalid stored vector format in document:', doc.id);
        continue;
      }

      try {
        const similarity = calculateSimilarity(faceVector, storedVector);
        console.log('Vector similarity:', similarity);
        
        // Track the highest similarity found
        if (similarity > highestSimilarity) {
          highestSimilarity = similarity;
          bestMatch = {
            id: doc.id,
            similarity,
            walletAddress: storedData.walletAddress,
            timestamp: storedData.timestamp
          };
        }
      } catch (error) {
        console.warn('Error comparing vectors:', error);
        continue;
      }
    }
    
    // If we found a match above threshold, return it
    // 0.8 is a good threshold for face recognition (same person)
    if (highestSimilarity > 0.8) {
      console.log('Face match found with similarity:', highestSimilarity);
      return bestMatch;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking existing face vector:', error);
    return false; // Don't throw, just return false
  }
};

// Function to store face vector in Firebase with wallet address
export const storeFaceVectorWithWallet = async (faceVector, walletAddress) => {
  // Check if Firebase is available
  if (!db || !collection || !addDoc) {
    console.warn('Firebase is not available, skipping face vector storage');
    return false;
  }
  
  try {
    if (!Array.isArray(faceVector)) {
      throw new Error('Invalid face vector format');
    }

    const faceVectorsRef = collection(db, 'faceVectors');
    const timestamp = new Date().toISOString();
    
    const docRef = await addDoc(faceVectorsRef, {
      vector: faceVector,
      timestamp: timestamp,
      walletAddress: walletAddress || 'unknown'
    });

    console.log('Successfully stored face vector with wallet address:', walletAddress, 'ID:', docRef.id);
    return true;
  } catch (error) {
    console.error('Error storing face vector with wallet:', error);
    return false;
  }
};