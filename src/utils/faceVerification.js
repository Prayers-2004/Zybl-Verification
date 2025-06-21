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

    // Pre-process vectors to ensure they're normalized
    const processedVector1 = vector1.map(val => Number(val));
    const processedVector2 = vector2.map(val => Number(val));
    
    // Check for invalid values
    const hasInvalidValues = [...processedVector1, ...processedVector2].some(val => isNaN(val));
    if (hasInvalidValues) {
      console.error('Invalid vector values detected');
      throw new Error('Invalid vector values');
    }

    // Calculate cosine similarity
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < processedVector1.length; i++) {
      const v1 = processedVector1[i];
      const v2 = processedVector2[i];
      
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
    // Ensure the similarity is within the valid range [0, 1]
    return Math.max(0, Math.min(1, similarity));
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
    
    // Keep track of all faces with similarity > 0.7 for debugging
    const similarFaces = [];
    
    for (const doc of querySnapshot.docs) {
      const storedData = doc.data();
      const storedVector = storedData.vector;
      
      if (!Array.isArray(storedVector)) {
        console.warn('Invalid stored vector format in document:', doc.id);
        continue;
      }

      try {
        const similarity = calculateSimilarity(faceVector, storedVector);
        
        // Track faces with significant similarity for debugging
        if (similarity > 0.7) {
          similarFaces.push({
            id: doc.id, 
            similarity, 
            walletAddress: storedData.walletAddress
          });
        }
        
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
    
    // Log all similar faces for debugging
    if (similarFaces.length > 0) {
      console.log('Similar faces found:');
      similarFaces.sort((a, b) => b.similarity - a.similarity);
      similarFaces.forEach(face => {
        console.log(`ID: ${face.id}, Similarity: ${face.similarity.toFixed(4)}, Wallet: ${face.walletAddress || 'none'}`);
      });
    }
    
    // If we found a match above threshold, return it
    // 0.9 is a more strict threshold for face recognition (same person)
    // This higher threshold helps distinguish different people more accurately
    if (highestSimilarity > 0.9) {
      console.log('Face match found with similarity:', highestSimilarity.toFixed(4));
      return bestMatch;
    } else if (highestSimilarity > 0.75) {
      // For debugging: log close matches that didn't meet our threshold
      console.log('Near match found but below threshold:', highestSimilarity.toFixed(4));
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