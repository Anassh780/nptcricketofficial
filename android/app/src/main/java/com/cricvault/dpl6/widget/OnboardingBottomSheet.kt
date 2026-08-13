package com.cricvault.dpl6.widget

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Download
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Native Jetpack Compose Material 3 Onboarding ModalBottomSheet Component
 * for CricVault Android Widget & Floating Live Score Walkthrough.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CricVaultOnboardingBottomSheet(
    onDismissRequest: () -> Unit,
    onComplete: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var currentStep by remember { mutableIntStateOf(1) }

    val greenAccent = Color(0xFF94ED28)
    val darkSurface = Color(0xFF07131B)
    val darkBackground = Color(0xFF03080E)

    ModalBottomSheet(
        onDismissRequest = onDismissRequest,
        sheetState = sheetState,
        containerColor = darkSurface,
        scrimColor = Color.Black.copy(alpha = 0.85f),
        shape = RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp),
        dragHandle = {
            Box(
                modifier = Modifier
                    .padding(vertical = 12.dp)
                    .width(40.dp)
                    .height(5.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.25f))
            )
        }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp)
                .padding(bottom = 24.dp)
        ) {
            // Header Bar
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Surface(
                        color = greenAccent.copy(alpha = 0.15f),
                        shape = RoundedCornerShape(6.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, greenAccent.copy(alpha = 0.4f))
                    ) {
                        Text(
                            text = "STEP $currentStep OF 4",
                            color = greenAccent,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.ExtraBold,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }
                    Text(
                        text = "Android Live Score Walkthrough",
                        color = Color.White,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }
                IconButton(onClick = onDismissRequest) {
                    Icon(imageVector = Icons.Default.Close, contentDescription = "Close", tint = Color.White)
                }
            }

            // Linear Progress Indicator
            LinearProgressIndicator(
                progress = { currentStep / 4f },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 16.dp)
                    .height(4.dp)
                    .clip(CircleShape),
                color = greenAccent,
                trackColor = Color.White.copy(alpha = 0.1f)
            )

            // Scrollable Content Box (LazyColumn)
            LazyColumn(
                modifier = Modifier
                    .weight(1f, fill = false)
                    .padding(vertical = 8.dp)
            ) {
                item {
                    when (currentStep) {
                        1 -> StepOneContent(greenAccent)
                        2 -> StepTwoContent(greenAccent)
                        3 -> StepThreeContent(greenAccent)
                        4 -> StepFourContent(greenAccent)
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Fixed Bottom Navigation Bar
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextButton(
                    onClick = { if (currentStep > 1) currentStep-- },
                    enabled = currentStep > 1
                ) {
                    Text(text = "Back", color = if (currentStep > 1) Color.LightGray else Color.Gray)
                }

                // Step Dots
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    for (i in 1..4) {
                        Box(
                            modifier = Modifier
                                .size(if (i == currentStep) 24.dp else 8.dp, 8.dp)
                                .clip(CircleShape)
                                .background(if (i == currentStep) greenAccent else Color.White.copy(alpha = 0.2f))
                        )
                    }
                }

                Button(
                    onClick = {
                        if (currentStep < 4) {
                            currentStep++
                        } else {
                            onComplete()
                            onDismissRequest()
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = greenAccent)
                ) {
                    Text(
                        text = if (currentStep == 4) "Finish & Launch 🚀" else "Next Step",
                        color = Color.Black,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}

@Composable
private fun StepOneContent(accentColor: Color) {
    Column {
        Text(text = "01. Install Native APK (base.apk)", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        Text(
            text = "Download the official CricVault Android native package (base.apk · 1.08 MB) to enable floating score bubbles above YouTube, WhatsApp, and games.",
            color = Color.LightGray,
            fontSize = 13.sp,
            modifier = Modifier.padding(top = 8.dp)
        )
    }
}

@Composable
private fun StepTwoContent(accentColor: Color) {
    Column {
        Text(text = "02. Enable Overlay Permission", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        Text(
            text = "Go to Android Settings -> Apps -> CricVault -> Display over other apps, and toggle ALLOW to enable floating heads.",
            color = Color.LightGray,
            fontSize = 13.sp,
            modifier = Modifier.padding(top = 8.dp)
        )
    }
}

@Composable
private fun StepThreeContent(accentColor: Color) {
    Column {
        Text(text = "03. Add Widget to Home Screen", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        Text(
            text = "Touch and hold your Android home screen, tap Widgets -> CricVault, and drag 2x1, 4x2, or 5x3 widgets onto your desktop.",
            color = Color.LightGray,
            fontSize = 13.sp,
            modifier = Modifier.padding(top = 8.dp)
        )
    }
}

@Composable
private fun StepFourContent(accentColor: Color) {
    Column {
        Text(text = "04. Launch Floating Score Head", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        Text(
            text = "Tap 'Float Live Score' to launch the live floating score bubble. It stays on top of all apps and updates every single ball!",
            color = Color.LightGray,
            fontSize = 13.sp,
            modifier = Modifier.padding(top = 8.dp)
        )
    }
}
